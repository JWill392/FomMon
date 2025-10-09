using System.Threading.Channels;

namespace FomMon.ApiService;

public interface IBackgroundTaskQueue
{
    public ValueTask QueueWorkAsync(WorkItem workItem);
    public ValueTask<WorkItem> DequeueWorkAsync(CancellationToken cancellationToken);
}

public record class WorkItem(string Name, Func<IServiceProvider, CancellationToken, Task> execute);

public class BackgroundTaskQueue : IBackgroundTaskQueue
{
    private readonly Channel<WorkItem> _queue;
    public BackgroundTaskQueue()
    {
        var options = new UnboundedChannelOptions()
        {
            SingleReader = true
        };
        _queue = Channel.CreateUnbounded<WorkItem>(options);
    }

    public async ValueTask QueueWorkAsync(WorkItem workItem)
    {
        if (workItem is null) throw new ArgumentNullException(nameof(workItem));
        await _queue.Writer.WriteAsync(workItem);
    }

    public async ValueTask<WorkItem> DequeueWorkAsync(CancellationToken cancellationToken)
    {
        var workItem = await _queue.Reader.ReadAsync(cancellationToken);
        return workItem;
    }
}
