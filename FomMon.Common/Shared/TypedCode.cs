using System.ComponentModel;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace FomMon.Common.Shared;

/// <summary>
/// Statically typed code value.  Behaves like a string, but with type safety.
/// Uses CRTP (curiously recurring template pattern; TypedCode<TSelf>) to provide type safety.
/// </summary>
/// <typeparam name="TSelf"></typeparam>
public abstract class TypedCode<TSelf>
    where TSelf : TypedCode<TSelf>
{
    protected TypedCode(string value)
    {
        Value = value;
        
        Validator?.Invoke((TSelf)this);
    }

    public string Value { get; }

    public override string ToString() => Value;

    // Validation hook configured by each derived type (static ctor or initializer).
    protected static Action<TSelf>? Validator { get; private set; }
    protected static void ConfigureValidator(Action<TSelf>? validator) => Validator = validator;

    // Factory that constructs and validates via delegate.
    public static TSelf From(string value)
    {
        var instance = (TSelf)Activator.CreateInstance(typeof(TSelf), value)!;
        Validator?.Invoke(instance);
        return instance;
    }

    // Helpful conversions
    public static implicit operator string(TypedCode<TSelf> code) => code.Value;
    public static explicit operator TypedCode<TSelf>(string value) => From(value);

    // Structural equality by Value and exact type
    public override bool Equals(object? obj) =>
        obj is TSelf other && StringComparer.Ordinal.Equals(Value, other.Value);

    public override int GetHashCode() => StringComparer.Ordinal.GetHashCode(Value);
}

public sealed class TypedCodeJsonConverter<TSelf> : JsonConverter<TSelf>
    where TSelf : TypedCode<TSelf>
{
    public override TSelf Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        TypedCode<TSelf>.From(reader.GetString() ?? string.Empty);

    public override void Write(Utf8JsonWriter writer, TSelf value, JsonSerializerOptions options) =>
        writer.WriteStringValue(value.Value);
}

public sealed class TypedCodeTypeConverter<TSelf> : TypeConverter
    where TSelf : TypedCode<TSelf>
{
    public override bool CanConvertFrom(ITypeDescriptorContext? context, Type sourceType) =>
        sourceType == typeof(string) || base.CanConvertFrom(context, sourceType);

    public override object? ConvertFrom(ITypeDescriptorContext? context, CultureInfo? culture, object value)
    {
        if (value is string s)
        {
            try { return TypedCode<TSelf>.From(s); }
            catch (ArgumentException e) { throw new FormatException(e.Message, e); }
        }
        return base.ConvertFrom(context, culture, value);
    }
}