import { forPage } from "@/lib/action-utils";
import { listClients } from "@/services/clients.service";
import { ClientsView } from "./clients-view";

export default async function ClientsPage() {
  const clients = await forPage(listClients());

  return (
    <div className="p-8">
      <ClientsView
        clients={clients.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          whatsappOptIn: c.whatsappOptIn,
          notes: c.notes,
          loginCount: c.loginCount,
        }))}
      />
    </div>
  );
}
