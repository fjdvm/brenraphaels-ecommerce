export type CustomerAddress = {
  label: string;
  street: string;
  barangay: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
};

export type CustomerOnFile = {
  userId: string;
  fullName: string;
  email: string;
  contactNumber: string;
  addresses: CustomerAddress[];
};

/** What Neon Auth tells us about the current login, if there is one. */
export type VisitorSession = { userId: string; email: string } | null;

export type Visitor =
  | { state: "signed-out" }
  | { state: "needs-details"; userId: string; email: string }
  | { state: "customer"; customer: CustomerOnFile };

export type VisitorStore = {
  findCustomer(userId: string): Promise<CustomerOnFile | undefined>;
};

export async function classifyVisitor(
  session: VisitorSession,
  dependencies: { visitorStore: VisitorStore },
): Promise<Visitor> {
  if (!session) {
    return { state: "signed-out" };
  }

  const customer = await dependencies.visitorStore.findCustomer(session.userId);
  if (!customer) {
    return {
      state: "needs-details",
      userId: session.userId,
      email: session.email,
    };
  }

  return { state: "customer", customer };
}
