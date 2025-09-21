using Microsoft.AspNetCore.Identity;
using System.Globalization;
using System.Text.RegularExpressions;

namespace TodoAppBackend.Models
{
    public class TurkishLookupNormalizer : ILookupNormalizer
    {
        private readonly Dictionary<string, string> _turkishToEnglishMap = new()
        {
            { "İ", "I" },
            { "I", "I" },
            { "Ğ", "G" },
            { "Ü", "U" },
            { "Ş", "S" },
            { "Ö", "O" },
            { "Ç", "C" },
            { "i", "I" },
            { "ı", "I" },
            { "ğ", "G" },
            { "ü", "U" },
            { "ş", "S" },
            { "ö", "O" },
            { "ç", "C" }
        };

        private string NormalizeTurkishCharacters(string? input)
        {
            if (string.IsNullOrEmpty(input))
                return string.Empty;

            string result = input.ToUpperInvariant();
            foreach (var kvp in _turkishToEnglishMap)
            {
                result = result.Replace(kvp.Key, kvp.Value);
            }
            return result;
        }

        public string? NormalizeName(string? name)
        {
            return NormalizeTurkishCharacters(name);
        }

        public string? NormalizeEmail(string? email)
        {
            return email?.ToUpperInvariant();
        }

        public string? Normalize(string? key)
        {
            return NormalizeTurkishCharacters(key);
        }
    }
}
