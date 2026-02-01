import { PrismaClient, User, Skill } from '@prisma/client';

export async function seedUserSkills(
  prisma: PrismaClient,
  allUsers: User[],
  createdSkills: Skill[]
) {
  console.log('BLOQUE: USER SKILLS');

  const userSkillAssignments: Array<{ email: string; skills: string[] }> = [
    { email: 'nuria@company.local',   skills: ['Vigilancia Perimetral', 'Primeros Auxilios', 'Certificado CCTV'] },
    { email: 'andres@company.local',  skills: ['Vigilancia Perimetral', 'Atención al Público'] },
    { email: 'elena@company.local',   skills: ['Mantenimiento Eléctrico', 'Trabajo en Altura'] },
    { email: 'mario@company.local',   skills: ['Manejo de Herramientas TI', 'Idiomas (Inglés B2)'] },
    { email: 'raul@company.local',    skills: ['Mantenimiento Eléctrico', 'Mantenimiento Climatización', 'Trabajo en Altura'] },
    { email: 'claudia@company.local', skills: ['Vigilancia Perimetral', 'Certificado CCTV', 'Idiomas (Inglés B2)'] },
    { email: 'ivan@company.local',     skills: ['Atención al Público', 'Idiomas (Inglés B2)'] },
    { email: 'marta@company.local',   skills: ['Vigilancia Perimetral', 'Primeros Auxilios'] },
  ];

  let assignedCount = 0;
  for (const assignment of userSkillAssignments) {
    const user = allUsers.find(u => u.email === assignment.email);
    if (!user) continue;

    for (const skillName of assignment.skills) {
      const skill = createdSkills.find(s => s.name === skillName);
      if (!skill) continue;

      const existing = await prisma.userSkill.findFirst({ where: { userId: user.id, skillId: skill.id } });
      if (!existing) {
        await prisma.userSkill.create({ data: { userId: user.id, skillId: skill.id } });
        assignedCount++;
      }
    }
  }

  console.log(`[USER_SKILL] ${assignedCount} user-skill assignments created`);
}
