using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Identity;

namespace TodoAppBackend.Models
{
    public class ApplicationUser : IdentityUser
    {
        public bool IsGuest { get; set; }

        [JsonIgnore]
        public ICollection<Todo> Todos { get; set; } = new List<Todo>();
    }
}