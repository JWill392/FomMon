using System.Text.Json.Serialization;
using FomMon.Common.Shared;

namespace FomMon.Common.Configuration.Layer;

/// <summary>
/// Code value for kind of layer. Provides some type-safety for this 'runtime enum'.
/// </summary>
[JsonConverter(typeof(TypedCodeJsonConverter<LayerKind>))]
[System.ComponentModel.TypeConverter(typeof(TypedCodeTypeConverter<LayerKind>))]
public sealed class LayerKind(string value) : TypedCode<LayerKind>(value)
{
    static LayerKind()
    {
        ConfigureValidator(kind =>
        {
            if (!LayerRegistry.Initialized) return;
            if (string.IsNullOrEmpty(kind.Value)) return;

            if (!LayerRegistry.AllKind.Contains(kind))
            {
                throw new ArgumentException(
                    $"LayerKind '{kind.Value}' is not registered. " +
                    $"Valid kinds: {string.Join(", ", LayerRegistry.AllKind)}",
                    nameof(kind));
            }
        });
    }

}
