using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Security.Claims;
using System.Text.RegularExpressions;
using TodoAppBackend.Data;
using TodoAppBackend.Models;

namespace TodoAppBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class TagsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<TagsController> _logger;

        public TagsController(ApplicationDbContext context, ILogger<TagsController> logger)
        {
            _context = context;
            _logger = logger;
        }

        private string GetCurrentUserId() => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

        // TR-uyumlu normalize: trim, çoklu boşlukları tek boşluk, tr-TR lower
        private static string Normalize(string? s)
        {
            var clean = Regex.Replace((s ?? string.Empty).Trim(), "\\s+", " ");
            return clean.ToLower(new CultureInfo("tr-TR"));
        }

        // GET: api/tags
        [HttpGet]
        public async Task<ActionResult<IEnumerable<TagDto>>> GetTags(CancellationToken ct)
        {
            var userId = GetCurrentUserId();

            var tags = await _context.Tags
                .Where(t => t.UserId == userId)
                .OrderBy(t => t.Name)
                .Select(t => new TagDto
                {
                    Id = t.Id,
                    Name = t.Name
                })
                .ToListAsync(ct);

            return Ok(tags);
        }

        // POST: api/tags
        [HttpPost]
        public async Task<ActionResult<TagDto>> CreateTag([FromBody] TagCreateDto dto, CancellationToken ct)
        {
            var userId = GetCurrentUserId();

            if (dto is null || string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest(new { message = "Etiket adı boş olamaz." });

            // İsim temizliği + sınırlar
            var name = Regex.Replace(dto.Name.Trim(), "\\s+", " ");
            if (name.Length > 50)
                return BadRequest(new { message = "Etiket adı 50 karakteri geçemez." });

            var normalized = Normalize(name);

            // Kullanıcı bazında duplikasyon kontrolü
            var exists = await _context.Tags
                .AnyAsync(t => t.UserId == userId && t.NameNormalized == normalized, ct);

            if (exists)
                return Conflict(new { message = $"\"{name}\" etiketi zaten mevcut." });

            var tag = new Tag
            {
                // Model set sırasında NameNormalized da güncellenecek
                Name = name,
                UserId = userId
            };

            _context.Tags.Add(tag);
            try
            {
                await _context.SaveChangesAsync(ct);
            }
            catch (DbUpdateException ex)
            {
                _logger.LogWarning(ex, "Tag create unique constraint violation");
                // Veritabanı seviyesinde unique index yakalanırsa yine 409
                return Conflict(new { message = $"\"{name}\" etiketi zaten mevcut." });
            }

            var result = new TagDto { Id = tag.Id, Name = tag.Name };
            return Ok(result);
        }

        // PUT: api/tags/5
        [HttpPut("{id:int}")]
        public async Task<IActionResult> UpdateTag([FromRoute] int id, [FromBody] TagUpdateDto dto, CancellationToken ct)
        {
            var userId = GetCurrentUserId();

            var tag = await _context.Tags
                .FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId, ct);

            if (tag == null)
                return NotFound(new { message = "Etiket bulunamadı." });

            if (dto is null || string.IsNullOrWhiteSpace(dto.Name))
                return BadRequest(new { message = "Etiket adı boş olamaz." });

            var name = Regex.Replace(dto.Name.Trim(), "\\s+", " ");
            if (name.Length > 50)
                return BadRequest(new { message = "Etiket adı 50 karakteri geçemez." });

            var normalized = Normalize(name);

            // Başka bir etikete çakışma var mı? (aynı kullanıcıda)
            var clash = await _context.Tags
                .AnyAsync(t => t.UserId == userId && t.Id != id && t.NameNormalized == normalized, ct);

            if (clash)
                return Conflict(new { message = $"\"{name}\" etiketi zaten mevcut." });

            tag.Name = name; // setter NameNormalized'ı da günceller

            try
            {
                await _context.SaveChangesAsync(ct);
            }
            catch (DbUpdateException ex)
            {
                _logger.LogWarning(ex, "Tag update unique constraint violation");
                return Conflict(new { message = $"\"{name}\" etiketi zaten mevcut." });
            }

            return Ok(new { message = "Etiket güncellendi." });
        }

        // DELETE: api/tags/5
        [HttpDelete("{id:int}")]
        public async Task<IActionResult> DeleteTag([FromRoute] int id, CancellationToken ct)
        {
            var userId = GetCurrentUserId();

            var tag = await _context.Tags
                .FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId, ct);

            if (tag == null)
                return NotFound(new { message = "Etiket bulunamadı." });

            _context.Tags.Remove(tag);
            await _context.SaveChangesAsync(ct);

            return Ok(new { message = "Etiket silindi." });
        }
    }
}
