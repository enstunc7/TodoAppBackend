using Microsoft.AspNetCore.Identity;

namespace TodoAppBackend.Models
{
    public class EmptyUserValidator : IUserValidator<ApplicationUser>
    {
        public Task<IdentityResult> ValidateAsync(UserManager<ApplicationUser> manager, ApplicationUser user)
        {
            return Task.FromResult(IdentityResult.Success);
        }
    }
}