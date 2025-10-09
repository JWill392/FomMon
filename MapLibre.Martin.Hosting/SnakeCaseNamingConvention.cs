using System.Text;
using YamlDotNet.Serialization;
using YamlDotNet.Serialization.NamingConventions;

namespace MapLibre.Martin.Hosting;

public sealed class SnakeCaseNamingConvention : INamingConvention
{
    private SnakeCaseNamingConvention() { }
    
    public string Apply(string value)
    {
        if (string.IsNullOrEmpty(value))
            return value;

        var sb = new StringBuilder(value.Length + 8);
        var prevIsLower = false;
        var prevIsLetterOrDigit = false;

        for (int i = 0; i < value.Length; i++)
        {
            char c = value[i];

            if (char.IsUpper(c))
            {
                // Insert underscore before a new word boundary:
                // - previous was lower (e.g., "KeepAlive" -> "keep_Alive")
                // - next is lower (e.g., "HTTPServer" -> "HTTP_Server" -> "http_server")
                bool nextIsLower = i + 1 < value.Length && char.IsLower(value[i + 1]);

                if ((prevIsLower || nextIsLower) && prevIsLetterOrDigit)
                    sb.Append('_');

                sb.Append(char.ToLowerInvariant(c));
                prevIsLower = true;
                prevIsLetterOrDigit = true;
            }
            else if (char.IsLetterOrDigit(c))
            {
                // Keep digits and lowercase letters
                if (char.IsLetter(c))
                    sb.Append(char.ToLowerInvariant(c));
                else
                    sb.Append(c);

                prevIsLower = char.IsLower(c);
                prevIsLetterOrDigit = true;
            }
            else
            {
                // For any non-alnum (e.g., spaces, hyphens), map to underscore once
                if (prevIsLetterOrDigit)
                    sb.Append('_');

                prevIsLower = false;
                prevIsLetterOrDigit = false;
            }
        }

        return sb.ToString().Trim('_');
    }

    public string Reverse(string value)
    {
        INamingConvention pascal = PascalCaseNamingConvention.Instance;
        return pascal.Apply(value);
    }
    
    public static readonly INamingConvention Instance = new SnakeCaseNamingConvention();
}