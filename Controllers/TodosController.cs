using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TodoAppBackend.Data;
using TodoAppBackend.Models;

namespace TodoAppBackend.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    [Authorize] // Bu kontrolcüyü sadece kimliği doğrulanmış kullanıcılar kullanabilir
    public class TodosController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public TodosController(ApplicationDbContext context)
        {
            _context = context;
        }

        // GET: api/Todos
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Todo>>> GetTodos()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null)
            {
                return Unauthorized();
            }

            return await _context.Todos
                .Where(t => t.UserId == userId)
                .ToListAsync();
        }

        // GET: api/Todos/5
        [HttpGet("{id}")]
        public async Task<ActionResult<Todo>> GetTodo(int id)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var todo = await _context.Todos
                .Where(t => t.UserId == userId && t.Id == id)
                .FirstOrDefaultAsync();

            if (todo == null)
            {
                return NotFound();
            }

            return todo;
        }

        // POST: api/Todos
        [HttpPost]
        public async Task<ActionResult<Todo>> PostTodo(Todo todo)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null)
            {
                return Unauthorized();
            }

            todo.UserId = userId;
            _context.Todos.Add(todo);
            await _context.SaveChangesAsync();

            return CreatedAtAction("GetTodo", new { id = todo.Id }, todo);
        }

        // DELETE: api/Todos/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTodo(int id)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var todo = await _context.Todos
                .Where(t => t.UserId == userId && t.Id == id)
                .FirstOrDefaultAsync();

            if (todo == null)
            {
                return NotFound();
            }

            _context.Todos.Remove(todo);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}