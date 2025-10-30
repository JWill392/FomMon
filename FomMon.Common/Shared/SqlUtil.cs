namespace FomMon.Common.Shared;

public static class SqlUtil
{
    
    public static string ValidateSqlIdentifier(string identifier)
    {
        if (!System.Text.RegularExpressions.Regex.IsMatch(identifier, @"^[a-zA-Z_][a-zA-Z0-9_]*$"))
        {
            throw new ArgumentException($"Invalid SQL identifier: {identifier}");
        }
        return identifier;
    }
}