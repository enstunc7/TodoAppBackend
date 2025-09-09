using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using System.Globalization;
using Microsoft.EntityFrameworkCore;

namespace TodoAppBackend.Models
{
    // NameNormalized üzerinde UNIQUE index
    [Index(nameof(UserId), nameof(NameNormalized), IsUnique = true)]
    public class Tag
    {
        public int Id { get; set; }

        private string _name = null!;

        [Required]
        [MaxLength(50)]
        public string Name
        {
            get => _name;
            set
            {
                // boşlukları temizle, çoklu boşluğu teke indir
                var clean = Regex.Replace((value ?? string.Empty).Trim(), "\\s+", " ");

                if (string.IsNullOrWhiteSpace(clean))
                    throw new ValidationException("Tag name is required.");

                if (clean.Length > 50)
                    throw new ValidationException("Tag name must be at most 50 characters.");

                _name = clean;
                // TR-uyumlu normalize (duplicate kontrolü için)
                NameNormalized = ToTrLower(clean);
            }
        }

        // Duplicate kontrolü için normalize isim (örn. "EV işleri" == "ev işleri")
        [Required]
        [MaxLength(80)]
        public string NameNormalized { get; private set; } = null!;

        [Required]
        public string UserId { get; set; } = null!;

        // Döngüyü kır: Tag -> User -> Tags -> ...
        [JsonIgnore]
        public ApplicationUser User { get; set; } = null!;

        // Döngüyü kır: Tag -> Todos -> Tags -> ...
        [JsonIgnore]
        public ICollection<Todo> Todos { get; set; } = new List<Todo>();

        private static string ToTrLower(string s)
            => s.ToLower(new CultureInfo("tr-TR"));
    }
}

