using System.Threading.Channels;

namespace FomMon.ApiService;

public interface IBackgroundTaskQueue
{
    public ValueTask QueueWorkAsync(Func<IServiceProvider, CancellationToken, Task> workItem);
    public ValueTask<Func<IServiceProvider, CancellationToken, Task>> DequeueWorkAsync(CancellationToken cancellationToken);
}

// TODO replace with real job queue library like Hangfire or Quartz

public class BackgroundTaskQueue : IBackgroundTaskQueue
{
    private readonly Channel<Func<IServiceProvider, CancellationToken, Task>> _queue;
    public BackgroundTaskQueue()
    {
        var options = new UnboundedChannelOptions()
        {
            SingleReader = true
        };
        _queue = Channel.CreateUnbounded<Func<IServiceProvider, CancellationToken, Task>>(options);
    }

    public async ValueTask QueueWorkAsync(Func<IServiceProvider, CancellationToken, Task> workItem)
    {
        if (workItem is null) throw new ArgumentNullException(nameof(workItem));
        await _queue.Writer.WriteAsync(workItem);
    }

    public async ValueTask<Func<IServiceProvider, CancellationToken, Task>> DequeueWorkAsync(CancellationToken cancellationToken)
    {
        var workItem = await _queue.Reader.ReadAsync(cancellationToken);
        return workItem;
    }
}
