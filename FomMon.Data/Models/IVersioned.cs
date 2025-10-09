namespace FomMon.Data.Models;

public interface IVersioned
{
    uint Version { get; set; }
}