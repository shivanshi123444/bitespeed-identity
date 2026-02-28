import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Properly infer Contact type from Prisma
type Contact = Awaited<ReturnType<typeof prisma.contact.findFirst>>;

export const identifyContact = async (
  email?: string,
  phoneNumber?: string
) => {
  if (!email && !phoneNumber) {
    throw new Error("Either email or phoneNumber must be provided");
  }

  const initialMatches = await prisma.contact.findMany({
    where: {
      OR: [
        { email: email ?? undefined },
        { phoneNumber: phoneNumber ?? undefined },
      ],
    },
  });

  if (initialMatches.length === 0) {
    const newPrimary = await prisma.contact.create({
      data: {
        email,
        phoneNumber,
        linkPrecedence: "primary",
      },
    });

    return formatResponse([newPrimary]);
  }

  const allRelatedContacts = await getAllLinkedContacts(initialMatches);

  const primary = findOldestContact(allRelatedContacts);

  await ensureSinglePrimary(primary, allRelatedContacts);

  const refreshedContacts = await prisma.contact.findMany({
    where: {
      OR: [{ id: primary.id }, { linkedId: primary.id }],
    },
    orderBy: { createdAt: "asc" },
  });

  const emailExists = refreshedContacts.some(
    (c: typeof refreshedContacts[number]) => c.email === email
  );

  const phoneExists = refreshedContacts.some(
    (c: typeof refreshedContacts[number]) =>
      c.phoneNumber === phoneNumber
  );

  if ((email && !emailExists) || (phoneNumber && !phoneExists)) {
    await prisma.contact.create({
      data: {
        email,
        phoneNumber,
        linkPrecedence: "secondary",
        linkedId: primary.id,
      },
    });
  }

  const finalContacts = await prisma.contact.findMany({
    where: {
      OR: [{ id: primary.id }, { linkedId: primary.id }],
    },
    orderBy: { createdAt: "asc" },
  });

  return formatResponse(finalContacts);
};



// BFS expansion
const getAllLinkedContacts = async (
  contacts: Awaited<ReturnType<typeof prisma.contact.findMany>>
) => {
  const visited = new Set<number>();
  const queue = [...contacts];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current.id)) continue;

    visited.add(current.id);

    const matches = await prisma.contact.findMany({
      where: {
        OR: [
          { email: current.email ?? undefined },
          { phoneNumber: current.phoneNumber ?? undefined },
          { id: current.linkedId ?? undefined },
          { linkedId: current.id },
        ],
      },
    });

    for (const match of matches) {
      if (!visited.has(match.id)) {
        queue.push(match);
      }
    }
  }

  return prisma.contact.findMany({
    where: {
      id: { in: Array.from(visited) },
    },
  });
};



const findOldestContact = (
  contacts: Awaited<ReturnType<typeof prisma.contact.findMany>>
) => {
  return contacts.reduce((oldest, current) =>
    current.createdAt < oldest.createdAt ? current : oldest
  );
};



const ensureSinglePrimary = async (
  primary: Awaited<ReturnType<typeof prisma.contact.findFirst>>,
  contacts: Awaited<ReturnType<typeof prisma.contact.findMany>>
) => {
  for (const contact of contacts) {
    if (contact.id === primary?.id) {
      if (contact.linkPrecedence !== "primary") {
        await prisma.contact.update({
          where: { id: contact.id },
          data: {
            linkPrecedence: "primary",
            linkedId: null,
          },
        });
      }
    } else {
      if (
        contact.linkPrecedence !== "secondary" ||
        contact.linkedId !== primary?.id
      ) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: {
            linkPrecedence: "secondary",
            linkedId: primary?.id,
          },
        });
      }
    }
  }
};



const formatResponse = (
  contacts: Awaited<ReturnType<typeof prisma.contact.findMany>>
) => {
  const primary = contacts.find(
    (c) => c.linkPrecedence === "primary"
  );

  const emails = Array.from(
    new Set(
      contacts
        .map((c) => c.email)
        .filter((email): email is string => Boolean(email))
    )
  );

  const phoneNumbers = Array.from(
    new Set(
      contacts
        .map((c) => c.phoneNumber)
        .filter((phone): phone is string => Boolean(phone))
    )
  );

  const secondaryContactIds = contacts
    .filter((c) => c.linkPrecedence === "secondary")
    .map((c) => c.id);

  return {
    contact: {
      primaryContatctId: primary?.id,
      emails,
      phoneNumbers,
      secondaryContactIds,
    },
  };
};
