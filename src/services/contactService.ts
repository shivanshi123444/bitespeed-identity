import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Infer Contact type from Prisma
type Contact = Awaited<ReturnType<typeof prisma.contact.findFirst>>;

export const identifyContact = async (
  email?: string,
  phoneNumber?: string
) => {
  if (!email && !phoneNumber) {
    throw new Error("Either email or phoneNumber must be provided");
  }

  // 1️⃣ Find initial matches
  const initialMatches = await prisma.contact.findMany({
    where: {
      OR: [
        { email: email ?? undefined },
        { phoneNumber: phoneNumber ?? undefined },
      ],
    },
  });

  // 2️⃣ If no matches → create new primary
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

  // 3️⃣ Get full connected graph
  const allRelatedContacts = await getAllLinkedContacts(initialMatches);

  // 4️⃣ Determine oldest contact
  const primary = findOldestContact(allRelatedContacts);

  // 5️⃣ Ensure only one primary
  await ensureSinglePrimary(primary, allRelatedContacts);

  // 6️⃣ Refresh contacts
  const refreshedContacts = await prisma.contact.findMany({
    where: {
      OR: [{ id: primary.id }, { linkedId: primary.id }],
    },
    orderBy: { createdAt: "asc" },
  });

  // 7️⃣ Check if new secondary needed
  const emailExists = refreshedContacts.some(
    (c) => c.email === email
  );

  const phoneExists = refreshedContacts.some(
    (c) => c.phoneNumber === phoneNumber
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

  // 8️⃣ Final fetch
  const finalContacts = await prisma.contact.findMany({
    where: {
      OR: [{ id: primary.id }, { linkedId: primary.id }],
    },
    orderBy: { createdAt: "asc" },
  });

  return formatResponse(finalContacts);
};



// 🔥 Fetch full connected component (BFS style)
const getAllLinkedContacts = async (contacts: any[]) => {
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



// 🔥 Find oldest contact
const findOldestContact = (contacts: any[]) => {
  return contacts.reduce((oldest, current) =>
    current.createdAt < oldest.createdAt ? current : oldest
  );
};



// 🔥 Ensure single primary
const ensureSinglePrimary = async (
  primary: any,
  contacts: any[]
) => {
  for (const contact of contacts) {
    if (contact.id === primary.id) {
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
        contact.linkedId !== primary.id
      ) {
        await prisma.contact.update({
          where: { id: contact.id },
          data: {
            linkPrecedence: "secondary",
            linkedId: primary.id,
          },
        });
      }
    }
  }
};



// 🔥 Format final response
const formatResponse = (contacts: any[]) => {
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
