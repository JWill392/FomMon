using System.Diagnostics;
using CliWrap;
using CliWrap.Buffered;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using OpenTelemetry.Trace;

namespace FomMon.Common.Infrastructure;

public interface IProcessRunner
{
    Task<ProcessResult> RunAsync(
        string fileName,
        IEnumerable<string> arguments,
        CancellationToken c = default);
}

public record ProcessResult(int ExitCode, string Output, string Error)
{
    public bool IsSuccess => ExitCode == 0;
}

public class CliWrapProcessRunner(
    ILogger<CliWrapProcessRunner> logger,
    ActivitySource? activitySource = null) : IProcessRunner
{
    public async Task<ProcessResult> RunAsync(
        string fileName,
        IEnumerable<string> arguments,
        CancellationToken c = default)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(fileName);
        var argsList = arguments.ToList();
        
        using var activity = activitySource?.StartActivity($"Process: {fileName}");
        
        activity?.SetTag("process.command", fileName);

        logger.LogInformation("Starting process: {Command} {Args}", 
            fileName, 
            string.Join(" ", argsList.Select(SanitizeForLog)));

        var stopwatch = Stopwatch.StartNew();

        try
        {
            var result = await Cli.Wrap(fileName)
                .WithArguments(argsList)
                .WithValidation(CommandResultValidation.None) // Don't throw on non-zero exit
                .ExecuteBufferedAsync(c);

            stopwatch.Stop();

            var processResult = new ProcessResult(
                result.ExitCode,
                result.StandardOutput,
                result.StandardError);

            activity?.SetTag("process.exit_code", processResult.ExitCode);
            activity?.SetTag("process.duration_ms", stopwatch.ElapsedMilliseconds);

            if (processResult.IsSuccess)
            {
                logger.LogInformation(
                    "Process completed successfully: {Command} (exit code: {ExitCode}, duration: {Duration}ms)",
                    fileName, processResult.ExitCode, stopwatch.ElapsedMilliseconds);
                
                if (!string.IsNullOrWhiteSpace(result.StandardOutput))
                {
                    logger.LogDebug("Process output: {Output}", result.StandardOutput);
                }
            }
            else
            {
                activity?.SetStatus(ActivityStatusCode.Error, $"Exit code: {processResult.ExitCode}");
                logger.LogError(
                    "Process failed: {Command} (exit code: {ExitCode}, duration: {Duration}ms)\nStderr: {Error}",
                    fileName, processResult.ExitCode, stopwatch.ElapsedMilliseconds, result.StandardError);
            }

            return processResult;
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            activity?.SetStatus(ActivityStatusCode.Error, ex.Message);
            activity?.AddException(ex);
            
            logger.LogError(ex, "Exception running process: {Command}", fileName);
            throw;
        }
    }

    private static string SanitizeForLog(string arg)
    {
        // Redact potential passwords/sensitive data
        if (arg.Contains("password=", StringComparison.OrdinalIgnoreCase))
        {
            return "password=***";
        }
        return arg.Length > 100 ? arg[..100] + "..." : arg;
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