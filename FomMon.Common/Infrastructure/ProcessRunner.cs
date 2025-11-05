using System.Diagnostics;
using CliWrap;
using FluentResults;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using OpenTelemetry.Trace;

namespace FomMon.Common.Infrastructure;

public interface IProcessRunner
{
    Task<Result<ProcessResult>> RunAsync(Command command, CancellationToken c = default);
    Task<Result<ProcessResult>> RunAsync(string commandPath, IEnumerable<string> arguments, CancellationToken c = default);
}

public record ProcessResult(int ExitCode, List<string> Output, List<string> Error);

public class ProcessError(int exitCode, List<string> output, List<string> error)
    : Error($"Process failed with exit code {exitCode}")
{
    public int ExitCode { get; } = exitCode;
    public List<string> Output { get; } = output;
    public List<string> Error { get; } = error;
}

public class TimeoutError(string message) : Error(message);

public class CliWrapProcessRunner(
    ILogger<CliWrapProcessRunner> logger,
    ActivitySource? activitySource = null) : IProcessRunner
{
    private const int ThrottleDurationSeconds = 10;
    
    public async Task<Result<ProcessResult>> RunAsync(
        string commandPath,
        IEnumerable<string> arguments,
        CancellationToken c = default)
    {
        var command = Cli.Wrap(commandPath).WithArguments(arguments);
        return await RunAsync(command, c);
    }

    public async Task<Result<ProcessResult>> RunAsync(
        Command command,
        CancellationToken c = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(command.TargetFilePath);
    
        using var activity = activitySource?.StartActivity($"Process: {command}");
    
        activity?.SetTag("process.command", command);

        logger.LogInformation("Starting process: {Command} {Args}", 
            command, 
            SanitizeForLog(command.Arguments));

    
        var stdOutBuffer = new List<string>();
        var stdErrBuffer = new List<string>();
        var lastLogTime = DateTime.MinValue;

        var stopwatch = Stopwatch.StartNew();
        try
        {
            var result = await command
                .WithValidation(CommandResultValidation.None)
            .WithStandardOutputPipe(PipeTarget.ToDelegate(line =>
                {
                    lastLogTime = ThrottleLog(line, lastLogTime, stdOutBuffer, "[StdOut]");
                }))
            .WithStandardErrorPipe(PipeTarget.ToDelegate(line =>
            {
                lastLogTime = ThrottleLog(line, lastLogTime, stdErrBuffer, "[StdErr]");
            }))
            .ExecuteAsync(c);

            stopwatch.Stop();

            var processResult = new ProcessResult(
                result.ExitCode,
                stdOutBuffer,
                stdErrBuffer);

            activity?.SetTag("process.exit_code", processResult.ExitCode);
            activity?.SetTag("process.duration_ms", stopwatch.ElapsedMilliseconds);

            if (processResult.ExitCode == 0)
            {
                logger.LogInformation(
                    "Process completed successfully: {Command} (exit code: {ExitCode}, duration: {Duration}ms)",
                    command, processResult.ExitCode, stopwatch.ElapsedMilliseconds);

                return Result.Ok(processResult);
            }
            else
            {
                activity?.SetStatus(ActivityStatusCode.Error, $"Exit code: {processResult.ExitCode}");
                logger.LogError(
                    "Process failed: {Command} (exit code: {ExitCode}, duration: {Duration}ms)\nStderr: {Error}",
                    command, processResult.ExitCode, stopwatch.ElapsedMilliseconds, processResult.Error.LastOrDefault());

                return Result.Fail(new ProcessError(processResult.ExitCode, processResult.Output, processResult.Error));
            }
        }
        catch (OperationCanceledException) when (c.IsCancellationRequested)
        {
            Activity.Current?.SetStatus(ActivityStatusCode.Error, "Timeout");
            return Result.Fail(new TimeoutError(
                $"Timed out after {stopwatch.ElapsedMilliseconds} milliseconds"));
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            activity?.AddException(ex);
        
            logger.LogError(ex, "Exception running process: {Command}", command);
            return Result.Fail(new ExceptionalError(ex));
        }

        DateTime ThrottleLog(string line, DateTime dateTime, List<string> outBuffer, string outputLabel)
        {
            var now = DateTime.UtcNow;
            var isSignificant = IsSignificantOutput(line);
            var shouldThrottle = (now - dateTime).TotalSeconds < ThrottleDurationSeconds;
                
            if (isSignificant || !shouldThrottle)
            {
                logger.LogInformation("{Label} {Line}", outputLabel, line);
                dateTime = now;
                outBuffer.Add(line);
            }

            return dateTime;
        }
    }
    


    private static string SanitizeForLog(string args)
    {
        var argsList = args.Split(" ")
            .Select(arg =>
            {
                if (arg.Contains("password=", StringComparison.OrdinalIgnoreCase))
                {
                    return "password=***";
                }

                return arg.Length > 100 ? arg[..100] + "..." : arg;
            });

        return String.Join(" ", argsList);
    }
    
    private static bool IsSignificantOutput(string line)
    {
        if (string.IsNullOrWhiteSpace(line)) return false;
    
        // Filter out progress bar noise
        if (line.Contains('%') && line.Contains('K') && line.Contains('/')) return false;
        if (line.TrimStart().StartsWith('[')) return false; // Progress bars like [=====>  ]
    
        // Log important events
        var significantKeywords = new[] { "saved", "downloaded", "complete", "error", "failed", "warning" };
        return significantKeywords.Any(k => line.Contains(k, StringComparison.OrdinalIgnoreCase));
    }
}

public static class ProcessRunnerExtensions
{
    public static IServiceCollection AddProcessRunner(this IServiceCollection services)
    {
        services.AddSingleton<ActivitySource>(sp => 
            new ActivitySource("FomMon.ProcessRunner"));
        
        services.AddSingleton<IProcessRunner, CliWrapProcessRunner>();
        
        services.ConfigureOpenTelemetryTracerProvider(t => 
        {
            t.AddSource("FomMon.ProcessRunner");
        });

        return services;
    }
}