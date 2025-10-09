using FomMon.ApiService.Infrastructure;

namespace FomMon.Tests.Mocks;

public sealed class TestCurrentUserService(Guid? id = null) : ICurrentUser
{
    public bool IsAuthenticated => Id is not null;
    public Guid? Id { get; } = id;
}