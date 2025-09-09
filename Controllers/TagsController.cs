using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
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

        // GET: api/tags
        [HttpGet]
        public async Task<ActionResult<IEnumerable<TagDto>>> GetTags()
        {
            var userId = GetCurrentUserId();

            var tags = await _context.Tags
                .Where(t => t.UserId == userId)
                .Select(t => new TagDto
                {
                    Id = t.Id,
                    Name = t.Name
                })
                .ToListAsync();

            return Ok(tags);
        }

        // POST: api/tags
        [HttpPost]
        public async Task<ActionResult<TagDto>> CreateTag([FromBody] TagCreateDto dto)
        {
            var userId = GetCurrentUserId();

            var tag = new Tag
            {
                Name = dto.Name,
                UserId = userId
            };

            _context.Tags.Add(tag);
            await _context.SaveChangesAsync();

            return Ok(new TagDto { Id = tag.Id, Name = tag.Name });
        }

        // PUT: api/tags/5
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateTag(int id, [FromBody] TagUpdateDto dto)
        {
            var userId = GetCurrentUserId();

            var tag = await _context.Tags.FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);
            if (tag == null)
                return NotFound(new { message = "Tag not found" });

            tag.Name = dto.Name;
            await _context.SaveChangesAsync();

            return Ok(new { message = "Tag updated successfully" });
        }

        // DELETE: api/tags/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTag(int id)
        {
            var userId = GetCurrentUserId();

            var tag = await _context.Tags.FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);
            if (tag == null)
                return NotFound(new { message = "Tag not found" });

            _context.Tags.Remove(tag);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Tag deleted successfully" });
        }
    }
}
