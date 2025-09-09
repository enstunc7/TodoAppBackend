using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using System.Security.Claims;
using TodoAppBackend.Data;
using TodoAppBackend.Models;

namespace TodoAppBackend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class GoalsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;

        public GoalsController(ApplicationDbContext context, UserManager<ApplicationUser> userManager)
        {
            _context = context;
            _userManager = userManager;
        }

        private string GetUserId() => User.FindFirstValue(ClaimTypes.NameIdentifier)!;

        // Kullanıcının mevcut hedefi
        [HttpGet]
        public async Task<ActionResult<int>> GetGoal()
        {
            var user = await _userManager.FindByIdAsync(GetUserId());
            if (user == null) return Unauthorized();

            return Ok(user.DailyGoal);
        }

        // Hedef belirleme / güncelleme
        [HttpPut]
        public async Task<IActionResult> SetGoal([FromBody] SetDailyGoalDto dto)
        {
            var user = await _userManager.FindByIdAsync(GetUserId());
            if (user == null) return Unauthorized();

            // Misafir kullanıcı hedef belirleyebilir mi? Karar size ait.
            // İstemiyorsanız: if (user.IsGuest) return Forbid();
            user.DailyGoal = dto.DailyGoal;

            var result = await _userManager.UpdateAsync(user);
            if (!result.Succeeded)
                return BadRequest(new { message = "Hedef güncellenemedi.", errors = result.Errors.Select(e => e.Description) });

            return Ok(new { dailyGoal = user.DailyGoal });
        }

        // Bugünkü ilerlemeyi döner (Tamamlanan / Hedef / Kupa)
        [HttpGet("today")]
        public async Task<ActionResult<DailyProgressDto>> GetTodayProgress()
        {
            var userId = GetUserId();
            var user = await _userManager.FindByIdAsync(userId);
            if (user == null) return Unauthorized();

            var today = DateTime.UtcNow.Date;

            // Bugün tamamlanan görevleri say (CompletedAt ile)
            var completedToday = await _context.Todos
                .Where(t => t.UserId == userId
                            && t.IsCompleted
                            && t.CompletedAt.HasValue
                            && t.CompletedAt.Value.Date == today)
                .CountAsync();

            var dto = new DailyProgressDto(
                CompletedToday: completedToday,
                DailyGoal: user.DailyGoal,
                Achieved: user.DailyGoal > 0 && completedToday >= user.DailyGoal
            );

            return Ok(dto);
        }
    }
}
