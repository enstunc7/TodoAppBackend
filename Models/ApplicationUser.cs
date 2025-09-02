using Microsoft.AspNetCore.Identity;
using System.ComponentModel.DataAnnotations;

namespace TodoAppBackend.Models
{
    public class ApplicationUser : IdentityUser
    {
        // Misafir kullanıcılar için benzersiz bir kullanıcı adı ataması yapılacak.
        // Bu sınıf, kayıtlı ve misafir kullanıcıları kapsayacak.
        
        // Buraya eklemek istediğin özel kullanıcı özellikleri gelebilir.
        // [Required]
        // public string FullName { get; set; }
    }
}