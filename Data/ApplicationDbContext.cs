
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using TodoAppBackend.Models;

namespace TodoAppBackend.Data
{
    public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }
        
        // Todo modelimiz için bir DbSet tanımlıyoruz.
        public DbSet<Todo> Todos { get; set; }
        
        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);
            // İlişkileri ve diğer yapılandırmaları burada tanımlayabilirsin.
        }
    }
}