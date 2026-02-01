import { PrismaClient, Skill } from '@prisma/client';

export async function seedSkills(prisma: PrismaClient) {
  console.log('BLOQUE: SKILLS');

  const skillsData = [
    { name: 'Vigilancia Perimetral', description: 'Control de accesos y ronda perimetral', category: 'seguridad', color: '#ef4444' },
    { name: 'Primeros Auxilios', description: 'Certificación en primeros auxilios', category: 'seguridad', color: '#f97316' },
    { name: 'Conducción Vehículo Oficial', description: 'Carnet B y experiencia en vehículo oficial', category: 'operaciones', color: '#84cc16' },
    { name: 'Mantenimiento Eléctrico', description: 'Instalaciones eléctricas BT/MT', category: 'mantenimiento', color: '#3b82f6' },
    { name: 'Mantenimiento Climatización', description: 'HVAC, sistemas de frío industrial', category: 'mantenimiento', color: '#8b5cf6' },
    { name: 'Atención al Público', description: 'Habilidades de comunicación presencial', category: 'administracion', color: '#ec4899' },
    { name: 'Manejo de Herramientas TI', description: 'Soporte técnico nivel 1', category: 'informatica', color: '#06b6d4' },
    { name: 'Idiomas (Inglés B2)', description: 'Inglés nivel B2 o superior', category: 'administracion', color: '#14b8a6' },
    { name: 'Certificado CCTV', description: 'Operación de sistemas de videovigilancia', category: 'seguridad', color: '#f59e0b' },
    { name: 'Trabajo en Altura', description: 'Certificación para trabajos en alturas > 2m', category: 'mantenimiento', color: '#dc2626' },
  ];

  const createdSkills: Skill[] = [];
  for (const s of skillsData) {
    const existing = await prisma.skill.findFirst({ where: { name: s.name } });
    if (existing) {
      console.log(`[SKILL] Already exists: ${s.name}`);
      createdSkills.push(existing);
    } else {
      const created = await prisma.skill.create({ data: s });
      console.log(`[SKILL] Created: ${s.name}`);
      createdSkills.push(created);
    }
  }

  return createdSkills;
}
