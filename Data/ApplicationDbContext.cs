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

        public DbSet<Tag> Tags { get; set; }
        public DbSet<Todo> Todos { get; set; }

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            // ✅ Todo - User ilişkisi
            builder.Entity<Todo>()
                .HasOne(t => t.User)
                .WithMany(u => u.Todos)
                .HasForeignKey(t => t.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // ✅ Tag - User ilişkisi
            builder.Entity<Tag>()
                .HasOne(t => t.User)
                .WithMany(u => u.Tags)
                .HasForeignKey(t => t.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            // ✅ Todo alan kuralları
            builder.Entity<Todo>()
                .Property(t => t.Title)
                .IsRequired()
                .HasMaxLength(200);

            builder.Entity<Todo>()
                .Property(t => t.CreatedAt)
                .HasDefaultValueSql("GETUTCDATE()");

            // ✅ Tag alan kuralları
            builder.Entity<Tag>()
                .Property(t => t.Name)
                .IsRequired()
                .HasMaxLength(50);

            // ✅ Todo - Tag many-to-many ilişkisi
            builder.Entity<Todo>()
                .HasMany(t => t.Tags)
                .WithMany(t => t.Todos)
                .UsingEntity<Dictionary<string, object>>(
                    "TodoTags",
                    j => j
                        .HasOne<Tag>()
                        .WithMany()
                        .HasForeignKey("TagId")
                        .OnDelete(DeleteBehavior.Cascade),
                    j => j
                        .HasOne<Todo>()
                        .WithMany()
                        .HasForeignKey("TodoId")
                        .OnDelete(DeleteBehavior.NoAction),
                    j =>
                    {
                        j.HasKey("TodoId", "TagId");
                        j.ToTable("TodoTags");
                    });
        }
    }
}
