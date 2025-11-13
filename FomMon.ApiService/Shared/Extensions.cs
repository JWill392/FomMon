using System.Text.Json;
using System.Text.Json.Nodes;

namespace FomMon.ApiService.Shared;

public static class Extensions
{

    public static bool HasProperty(this JsonDocument document, string propertyName) => 
        document.RootElement.TryGetProperty(propertyName, out _);
    
    public static JsonDocument WithRemovedProperties(this JsonDocument doc, params string[] propertyNames)
    {
        var node = JsonNode.Parse(doc.RootElement.GetRawText()) as JsonObject
                   ?? throw new InvalidOperationException("Root is not a JSON object.");

        foreach (string name in propertyNames)
        {
            node.Remove(name);
        }

        var json = node.ToJsonString();
        return JsonDocument.Parse(json);
    }
}