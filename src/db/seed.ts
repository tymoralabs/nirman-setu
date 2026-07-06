import { config } from "dotenv";
config({ path: ".env" });

import bcrypt from "bcryptjs";

const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;

async function getSeedDb() {
  if (process.env.DATABASE_URL) {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { default: postgres } = await import("postgres");
    const client = postgres(process.env.DATABASE_URL, { max: 1 });
    return { db: drizzle(client), close: () => client.end() };
  }
  const { drizzle } = await import("drizzle-orm/pglite");
  const { PGlite } = await import("@electric-sql/pglite");
  const { mkdirSync } = await import("node:fs");
  mkdirSync("./.data", { recursive: true });
  const pglite = new PGlite("./.data/pglite");
  return { db: drizzle(pglite), close: () => pglite.close() };
}

async function main() {
  const schema = await import("./schema");
  const {
    planLimits,
    firms,
    users,
    clients,
    checklistLibraryItems,
    checklistTemplates,
    checklistTemplateItems,
  } = schema;
  const { db, close } = await getSeedDb();

  // Idempotency: bail if already seeded
  const existing = await db.select().from(planLimits);
  if (existing.length > 0) {
    console.log("Already seeded — skipping. Delete .data/ to reseed.");
    await close();
    return;
  }

  // ---- Plan limits (§4) ----
  await db.insert(planLimits).values([
    {
      tier: "silver",
      priceInrMonthly: 1499,
      maxAssociates: 3,
      maxActiveProjects: 10,
      maxStorageBytes: 5 * GB,
      maxClients: 25,
      maxFileSizeBytes: 25 * MB,
      whatsappQuotaPerMonth: 200,
    },
    {
      tier: "gold",
      priceInrMonthly: 3999,
      maxAssociates: 10,
      maxActiveProjects: 50,
      maxStorageBytes: 25 * GB,
      maxClients: 100,
      maxFileSizeBytes: 25 * MB,
      whatsappQuotaPerMonth: 1000,
    },
    {
      tier: "platinum",
      priceInrMonthly: 7999,
      maxAssociates: -1,
      maxActiveProjects: -1,
      maxStorageBytes: 100 * GB,
      maxClients: -1,
      maxFileSizeBytes: 50 * MB,
      whatsappQuotaPerMonth: 5000,
    },
  ]);

  // ---- Demo firms ----
  const [firm1] = await db
    .insert(firms)
    .values({
      name: "Deshpande & Associates",
      slug: "deshpande-associates",
      planTier: "gold",
      planStatus: "active",
      state: "Maharashtra",
      grievanceEmail: "grievance@deshpande.example",
    })
    .returning();

  const [firm2] = await db
    .insert(firms)
    .values({
      name: "Mehta Liaison Services",
      slug: "mehta-liaison",
      planTier: "silver",
      planStatus: "active",
      state: "Gujarat",
    })
    .returning();

  // ---- Staff (email + password) ----
  const passwordHash = await bcrypt.hash("Password@123", 12);

  await db.insert(users).values([
    {
      role: "platform_owner",
      name: "Platform Owner",
      email: "owner@platform.test",
      passwordHash,
      status: "active",
      firmId: null,
    },
    {
      firmId: firm1.id,
      role: "firm_admin",
      name: "Ar. Rajesh Deshpande",
      email: "admin@deshpande.test",
      passwordHash,
      status: "active",
    },
    {
      firmId: firm1.id,
      role: "associate",
      name: "Priya Kulkarni",
      email: "priya@deshpande.test",
      passwordHash,
      status: "active",
    },
    {
      firmId: firm1.id,
      role: "associate",
      name: "Amit Joshi",
      email: "amit@deshpande.test",
      passwordHash,
      status: "active",
    },
    {
      firmId: firm2.id,
      role: "firm_admin",
      name: "Ar. Kiran Mehta",
      email: "admin@mehta.test",
      passwordHash,
      status: "active",
    },
  ]);

  // ---- Clients (phone + OTP; one phone exists in BOTH firms → account picker) ----
  const [client1] = await db
    .insert(clients)
    .values({
      firmId: firm1.id,
      name: "Suresh Patil",
      phone: "+919876543210",
      email: "suresh@example.com",
      whatsappOptIn: true,
    })
    .returning();

  const [client2] = await db
    .insert(clients)
    .values({
      firmId: firm1.id,
      name: "Anita Sharma",
      phone: "+919812345678",
      whatsappOptIn: true,
    })
    .returning();

  // same person (same phone) is also a client of firm 2 — exercises account picker
  const [client3] = await db
    .insert(clients)
    .values({
      firmId: firm2.id,
      name: "Suresh Patil",
      phone: "+919876543210",
      whatsappOptIn: true,
    })
    .returning();

  await db.insert(users).values([
    {
      firmId: firm1.id,
      role: "client",
      name: "Suresh Patil",
      phone: "+919876543210",
      clientId: client1.id,
      status: "active",
      preferredLanguage: "en",
    },
    {
      firmId: firm1.id,
      role: "client",
      name: "Anita Sharma",
      phone: "+919812345678",
      clientId: client2.id,
      status: "active",
      preferredLanguage: "hi",
    },
    {
      firmId: firm2.id,
      role: "client",
      name: "Suresh Patil",
      phone: "+919876543210",
      clientId: client3.id,
      status: "active",
    },
  ]);

  // ---- Library: ~30 real Indian liaison document types (Phase 2 seed, §6) ----
  const lib = (
    category: string,
    title: string,
    helpText: string,
    titleHi?: string
  ) => ({ firmId: firm1.id, category, title, helpText, titleHi });

  const libraryRows = [
    // Land Records
    lib("Land Records", "Sale Deed", "The registered document proving purchase of the land/flat. Get a certified copy from the Sub-Registrar office where it was registered.", "विक्रय विलेख (सेल डीड)"),
    lib("Land Records", "7/12 Extract (Satbara / RTC)", "Land revenue record showing ownership and crop details. Download from mahabhulekh.maharashtra.gov.in or get from the Talathi office.", "सात-बारा उतारा"),
    lib("Land Records", "Property Card", "Urban land ownership record. Available from the City Survey Office or online state land-records portal.", "प्रॉपर्टी कार्ड"),
    lib("Land Records", "Mutation Entry (Ferfar)", "Record of change in ownership in revenue records. Get from the Talathi / Tehsildar office.", "फेरफार नोंद"),
    lib("Land Records", "Index II", "Summary of the registered document issued by the Sub-Registrar. Usually given along with your Sale Deed.", "इंडेक्स २"),
    lib("Land Records", "Title Search Report", "Lawyer's report tracing ownership for 30 years. Your advocate prepares this from Sub-Registrar records."),
    // Approvals
    lib("Approvals", "NA Order (Non-Agricultural Permission)", "Permission converting agricultural land for building use. Issued by the Collector's office.", "अकृषिक (एन.ए.) आदेश"),
    lib("Approvals", "Zone Certificate / ULC Certificate", "Certifies the land-use zone of your plot. Get from the Town Planning office."),
    lib("Approvals", "Sanctioned Building Plan", "The building plan approved by the municipal corporation / council with their stamp."),
    lib("Approvals", "Commencement Certificate (CC)", "Municipal permission to start construction. Issued by the local planning authority.", "प्रारंभ प्रमाणपत्र"),
    lib("Approvals", "Occupancy Certificate (OC)", "Certificate that the building is fit for occupation. Issued by the municipal authority after completion.", "भोगवटा प्रमाणपत्र"),
    lib("Approvals", "RERA Registration Certificate", "Project registration under RERA. Download from the state RERA portal (e.g. maharera.mahaonline.gov.in)."),
    // Identity
    lib("Identity", "PAN Card", "Copy of PAN card of the owner(s). Both sides if printed on both.", "पैन कार्ड"),
    lib("Identity", "Aadhaar Card (Masked)", "Masked Aadhaar (shows only last 4 digits) is acceptable and preferred. Download a masked copy from myaadhaar.uidai.gov.in → 'Download Aadhaar' → choose 'Masked Aadhaar'.", "आधार कार्ड (मास्क्ड)"),
    // NOCs
    lib("NOC", "Fire NOC", "No-objection certificate from the Fire Department. Required for buildings above specified height."),
    lib("NOC", "Environment NOC / EC", "Environmental clearance for larger projects. From the State Environment Impact Assessment Authority."),
    lib("NOC", "Aviation NOC (AAI)", "Height clearance from Airports Authority of India, needed near airports. Apply on noca.gov.in."),
    lib("NOC", "Society NOC", "No-objection letter from your housing society for the proposed work, signed by the society secretary/chairman.", "सोसायटी एनओसी"),
    // Utilities
    lib("Utilities", "Water Connection Sanction", "Sanction letter / receipt for municipal water connection."),
    lib("Utilities", "Electricity Sanction / Load Approval", "Sanctioned load letter from the electricity distribution company (e.g. MSEDCL, Torrent)."),
    // Legal
    lib("Legal", "Power of Attorney", "Registered PoA if someone signs on the owner's behalf. Certified copy from the Sub-Registrar.", "मुखत्यारपत्र"),
    lib("Legal", "Development Agreement", "Registered agreement between landowner and developer, if applicable."),
    lib("Legal", "Partnership Deed / Company Documents", "If the owner is a firm/company: partnership deed or certificate of incorporation + board resolution."),
    lib("Legal", "Heirship Certificate / Succession Documents", "If ownership came by inheritance: heirship certificate or registered release deed from other heirs."),
    // Financial
    lib("Financial", "Property Tax Receipt (Latest)", "Latest paid property tax receipt from the municipal corporation.", "मालमत्ता कर पावती"),
    lib("Financial", "Loan Sanction Letter", "Bank's sanction letter if the project is loan-funded."),
    lib("Financial", "Encumbrance Certificate", "Certificate showing the property is free of legal dues. From the Sub-Registrar office."),
    // Site
    lib("Site", "Site Photographs", "Clear photos of the plot/building from all four sides, taken recently.", "साइटचे फोटो"),
    lib("Site", "Survey / Measurement Plan (DILR)", "Certified plot measurement map from the District Inspector of Land Records."),
    lib("Site", "Soil Investigation Report", "Geotechnical report from an approved lab, needed for structural design."),
  ];

  const insertedLib = await db
    .insert(checklistLibraryItems)
    .values(libraryRows)
    .returning();

  const byTitle = new Map(insertedLib.map((r) => [r.title, r]));

  // ---- Templates ----
  const [tpl1] = await db
    .insert(checklistTemplates)
    .values({
      firmId: firm1.id,
      name: "New Bungalow — Initial Documents",
      description: "Standard first checklist for a new residential bungalow project.",
    })
    .returning();

  const tpl1Items = [
    "Sale Deed",
    "7/12 Extract (Satbara / RTC)",
    "Index II",
    "Mutation Entry (Ferfar)",
    "NA Order (Non-Agricultural Permission)",
    "Zone Certificate / ULC Certificate",
    "PAN Card",
    "Aadhaar Card (Masked)",
    "Property Tax Receipt (Latest)",
    "Site Photographs",
    "Survey / Measurement Plan (DILR)",
    "Soil Investigation Report",
    "Title Search Report",
    "Encumbrance Certificate",
  ];

  await db.insert(checklistTemplateItems).values(
    tpl1Items.map((title, i) => ({
      templateId: tpl1.id,
      libraryItemId: byTitle.get(title)!.id,
      isMandatory: true,
      sortOrder: i,
    }))
  );

  const [tpl2] = await db
    .insert(checklistTemplates)
    .values({
      firmId: firm1.id,
      name: "Completion / OC Documents",
      description: "Documents needed at project completion for occupancy certificate.",
    })
    .returning();

  const tpl2Items = [
    "Commencement Certificate (CC)",
    "Sanctioned Building Plan",
    "Fire NOC",
    "Water Connection Sanction",
    "Electricity Sanction / Load Approval",
    "Site Photographs",
  ];

  await db.insert(checklistTemplateItems).values(
    tpl2Items.map((title, i) => ({
      templateId: tpl2.id,
      libraryItemId: byTitle.get(title)!.id,
      isMandatory: i < 5,
      sortOrder: i,
    }))
  );

  console.log("✅ Seeded:");
  console.log("   Firms: Deshpande & Associates (gold), Mehta Liaison Services (silver)");
  console.log("   Staff logins (password: Password@123):");
  console.log("     owner@platform.test   (platform owner)");
  console.log("     admin@deshpande.test  (firm admin)");
  console.log("     priya@deshpande.test  (associate)");
  console.log("     amit@deshpande.test   (associate)");
  console.log("     admin@mehta.test      (firm admin, 2nd firm)");
  console.log("   Clients (phone + OTP — OTP printed to console in dev):");
  console.log("     +919876543210 Suresh Patil  (client of BOTH firms → account picker)");
  console.log("     +919812345678 Anita Sharma  (Hindi preference)");
  console.log(`   Library: ${libraryRows.length} items, 2 templates`);

  await close();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
