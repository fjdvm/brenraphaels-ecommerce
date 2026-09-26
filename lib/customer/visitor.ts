export type CustomerAddress = {
  id: number;
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
  firstName: string;
  middleName: string | null;
  lastName: string;
  fullName: string;
  email: string;
  contactNumber: string;
  addresses: CustomerAddress[];
};

/** What Neon Auth tells us about the current login, if there is one. */
export type VisitorSession = {
  userId: string;
  email: string;
  /** The single name given at sign-up; the Customer's name parts are not known yet. */
  fullName: string;
} | null;

export type Visitor =
  | { state: "signed-out" }
  | { state: "needs-details"; userId: string; email: string; fullName: string }
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
      fullName: session.fullName,
    };
  }

  return { state: "customer", customer };
}
