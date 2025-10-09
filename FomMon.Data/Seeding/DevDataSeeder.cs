using FomMon.Data.Contexts;
using FomMon.Data.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace FomMon.Data.Seeding;


public sealed class DevDataSeeder(ILogger logger)
{
    public async Task SeedAsync(AppDbContext db, bool force)
    {
        logger.LogInformation("Seeding dev data (force={Force})", force);

        var adminEmail = "admin@example.local";
        var admin = await db.Users.FirstOrDefaultAsync(u => u.Email == adminEmail);
        if (admin == null)
        {
            db.Users.Add(new User
            {
                // Use deterministic keys where possible
                Id = new Guid("9903ED01-A73C-4874-8ABF-D2678E3AE23E"),
                Email = adminEmail,
                DisplayName = "Admin",
                // other required fields...
            });
        }
        else if (force)
        {
            // Optionally update fields in force mode
            admin.DisplayName = "Admin";
            db.Users.Update(admin);
        }


        await db.SaveChangesAsync();

        logger.LogInformation("Dev data seeding complete");
    }
}
