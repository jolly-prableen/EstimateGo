import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import Constants from "expo-constants";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

const API = `${Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL || ""}/api`;
const C = { bg: "#FBFBFA", ink: "#1A1D1A", muted: "#5A615C", green: "#3B5338", greenDeep: "#2C402A", pale: "#E3EADF", greenSoft: "#DCE9D8", line: "#E1E5DF", card: "#F3F4F1", white: "#FFFFFF", red: "#9B2226", redSoft: "#F7ECEC", gold: "#D99A2B", goldSoft: "#F8EDD7", goldInk: "#8A5F0E" };
type Tab = "Home" | "Bills" | "Vault" | "Stock" | "Profile";
type Product = { id: string; name: string; sku: string; stock: number; price: number; unit: string };
type Customer = { id: string; name: string; phone?: string; address?: string; dues?: number; open_bills?: number };
type User = { id: string; username: string; role: string };
type Session = { token: string; user: { username: string; role: string } };
type Recurring = { id: string; customer: string; amount: number; day_of_month: number; next_run: string; payment_mode?: string; items?: any[]; tax_rate?: number; discount?: number; discount_type?: string };
type QueueItem = { localId: string; created_at: string; payload: { customer: string; items: any[]; tax_rate: number; discount: number; discount_type: string; payment_mode: string } };
type Bill = { id: string; customer: string; total: number; subtotal?: number; discount_amount?: number; tax?: number; payment_status: string; payment_mode?: string; created_by?: string; created_at: string; __offline?: boolean; items?: { name: string; quantity: number; price: number; productId?: string }[] };

let AUTH = "";
const call = async (path: string, options?: RequestInit) => {
  const r = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json", ...(AUTH ? { Authorization: `Bearer ${AUTH}` } : {}) }, ...options });
  if (!r.ok) {
    const err: any = new Error(await r.text());
    err.status = r.status;
    throw err;
  }
  return r.json();
};
const kv = {
  get: async (k: string) => { try { return Platform.OS === "web" ? (window as any).localStorage.getItem(k) : await AsyncStorage.getItem(k); } catch { return null; } },
  set: async (k: string, v: string) => { try { if (Platform.OS === "web") (window as any).localStorage.setItem(k, v); else await AsyncStorage.setItem(k, v); } catch {} },
  del: async (k: string) => { try { if (Platform.OS === "web") (window as any).localStorage.removeItem(k); else await AsyncStorage.removeItem(k); } catch {} },
};
const money = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const computeTotalPreview = (items: any[], taxPct: number, discount: number, discountType: string) => {
  const subtotal = (items || []).reduce((s, x) => s + Number(x.price || 0) * Number(x.quantity || 0), 0);
  const dAmt = Math.round(discountType === "percent" ? subtotal * (Math.min(discount, 100) / 100) : Math.min(discount || 0, subtotal));
  const taxable = subtotal - dAmt;
  return { subtotal, discountAmount: dAmt, total: Math.round(taxable + taxable * ((taxPct || 0) / 100)) };
};
const estimateBody = (bill: any) => `<p style="font-size:17px"><b>Customer:</b> ${bill.customer}</p><table border="1" cellspacing="0" cellpadding="8" width="100%" style="border-collapse:collapse;border-color:#888"><tr style="background:#E3EADF"><th align="left">S.No.</th><th align="left">Item</th><th align="right">Qty</th><th align="right">Rate</th><th align="right">Amount</th></tr>${(bill.items || []).map((x: any, i: number) => `<tr><td>${i + 1}</td><td>${x.name}</td><td align="right">${x.quantity}</td><td align="right">₹${Number(x.price).toLocaleString("en-IN")}</td><td align="right">₹${(x.quantity * x.price).toLocaleString("en-IN")}</td></tr>`).join("")}<tr><td colspan="4" align="right"><b>Total</b></td><td align="right"><b>₹${Number(bill.total || 0).toLocaleString("en-IN")}</b></td></tr></table>`;
const htmlFor = (bill: any) => `<html><body style="font-family:Arial;padding:32px">${estimateBody(bill)}</body></html>`;
const printEstimate = (bill: any) => { if (Platform.OS === "web") { const w = window.open("", "_blank"); if (!w) return Alert.alert("Allow pop-ups", "Enable pop-ups for this site to print estimates."); w.document.write(`<!DOCTYPE html><html><head><title>Estimate</title><style>@page{margin:16mm}body{font-family:Arial;margin:0;padding:24px;color:#111}.bar{display:flex;gap:10px;justify-content:flex-end;margin-bottom:14px}.bar button{padding:10px 22px;border:none;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer}.bp{background:#3B5338;color:#fff}.bx{background:#E7EAE5;color:#1A1D1A}@media print{.bar{display:none}body{padding:8px}}</style></head><body><div class="bar"><button class="bp" onclick="window.print()">Print</button><button class="bx" onclick="window.close()">Back</button></div>${estimateBody(bill)}</body></html>`); w.document.close(); w.focus(); } else { Print.printAsync({ html: htmlFor(bill) }); } };
const shareEstimate = async (bill: any) => { if (Platform.OS === "web") { printEstimate(bill); return; } const file = await Print.printToFileAsync({ html: htmlFor(bill) }); if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri); };

function BrandMark({ size = 44 }: { size?: number }) {
  const lw = Math.max(2, size * 0.05);
  return <View style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: C.green, alignItems: "center", justifyContent: "center" }}>
    <View style={{ width: size * 0.46, height: size * 0.58, backgroundColor: C.white, borderRadius: size * 0.05, paddingTop: size * 0.11, gap: lw }}>
      <View style={{ height: lw, marginHorizontal: size * 0.09, backgroundColor: C.pale }} />
      <View style={{ height: lw, marginHorizontal: size * 0.09, backgroundColor: C.pale }} />
      <View style={{ height: lw, marginHorizontal: size * 0.09, backgroundColor: C.goldSoft }} />
    </View>
    <View style={{ position: "absolute", right: -size * 0.04, bottom: size * 0.06 }}><Ionicons name="trending-up" size={size * 0.36} color={C.gold} /></View>
  </View>;
}

function StatusPill({ status }: { status: string }) {
  const map: any = { Paid: { bg: C.greenSoft, fg: C.green }, Pending: { bg: C.goldSoft, fg: C.goldInk }, Waiting: { bg: C.redSoft, fg: C.red } };
  const s = map[status] || map.Pending;
  return <View style={[styles.pill, { backgroundColor: s.bg }]}><Text style={[styles.pillText, { color: s.fg }]}>{status}</Text></View>;
}

export default function Index() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    (async () => {
      if (Platform.OS === "web") {
        const raw = await kv.get("eg_session");
        if (raw) { const s: Session = JSON.parse(raw); AUTH = s.token; setSession(s); }
      }
      setBooting(false);
    })();
  }, []);

  const onLogin = (s: Session) => { AUTH = s.token; setSession(s); kv.set("eg_session", JSON.stringify(s)); };
  const signOut = () => { AUTH = ""; kv.del("eg_session"); setSession(null); };

  if (booting) return <SafeAreaView style={styles.loader}><ActivityIndicator color={C.green} size="large" /></SafeAreaView>;
  if (!session) return <SafeAreaView style={styles.safe}><Login onLogin={onLogin} /></SafeAreaView>;
  return <Workspace key={session.user.username} session={session} signOut={signOut} />;
}

function Login({ onLogin }: { onLogin: (s: Session) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!username.trim() || !password) return Alert.alert("Missing details", "Enter your username and password.");
    setBusy(true);
    try {
      const s = await call("/login", { method: "POST", body: JSON.stringify({ username, password }) });
      onLogin(s);
    } catch (e: any) {
      Alert.alert("Couldn't sign in", e.status === 401 ? "Wrong username or password." : "Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };
  const quick = (u: string, p: string) => { setUsername(u); setPassword(p); };
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}><View style={styles.decoCircleA} /><View style={styles.decoCircleB} /><ScrollView contentContainerStyle={[styles.scroll, { justifyContent: "center", flexGrow: 1 }]}><View style={{ alignItems: "center", marginBottom: 30 }}><BrandMark size={84} /><Text style={styles.brandTitle}>EstimateGo</Text><Text style={styles.muted}>Wholesale billing for your shop</Text></View><View style={styles.formCard}><Text style={styles.label}>USERNAME</Text><TextInput testID="login-username" value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="admin or staff" placeholderTextColor="#9AA29B" style={styles.input} /><Text style={styles.label}>PASSWORD</Text><TextInput testID="login-password" value={password} onChangeText={setPassword} secureTextEntry placeholder="Your password" placeholderTextColor="#9AA29B" style={styles.input} /><Pressable testID="login-submit" onPress={submit} disabled={busy} style={({ pressed }) => [styles.primary, pressed && styles.pressed, busy && { opacity: 0.6 }]}><Ionicons name="log-in-outline" size={20} color={C.white} /><Text style={styles.primaryText}>{busy ? "Signing in…" : "Sign in"}</Text></Pressable></View><View style={styles.hintCard}><Text style={styles.label}>FIRST TIME?</Text><Text style={styles.note}>Tap a role to fill demo credentials, then Sign in.</Text><View style={styles.btnRow}><Pressable onPress={() => quick("admin", "admin123")} style={[styles.quickBtn, { backgroundColor: C.green }]}><Text style={[styles.quickBtnText, { color: C.white }]}>Admin</Text></Pressable><Pressable onPress={() => quick("staff", "staff123")} style={styles.quickBtn}><Text style={styles.quickBtnText}>Staff</Text></Pressable></View><Text style={styles.note}>Admin: full control · Staff: billing only</Text></View></ScrollView></KeyboardAvoidingView>;
}

function Workspace({ session, signOut }: { session: Session; signOut: () => void }) {
  const role = session.user.role;
  const [tab, setTab] = useState<Tab>("Home");
  const [dashboard, setDashboard] = useState<any>(null);
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [editingBill, setEditingBill] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [recurringList, setRecurringList] = useState<Recurring[]>([]);
  const [profile, setProfile] = useState<any>({ name: "", address: "", phone: "", tax_id: "", payment_terms: "Due on receipt" });
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const syncingRef = useRef(false);
  const promptedRef = useRef("");

  const loadQueue = async () => { const raw = await kv.get("eg_queue"); if (raw) setQueue(JSON.parse(raw)); };
  const persistQueue = async (q: QueueItem[]) => { setQueue(q); await kv.set("eg_queue", JSON.stringify(q)); };

  const enqueueOffline = async (payload: QueueItem["payload"]) => {
    const entry: QueueItem = { localId: `${Date.now()}-${Math.floor(Math.random() * 999)}`, created_at: new Date().toISOString(), payload };
    await persistQueue([...queue, entry]);
    setOnline(false);
    Alert.alert("No connection — saved on this device", `${payload.customer}'s bill will sync automatically when you're back online.`);
  };

  const syncQueue = async () => {
    if (syncingRef.current || !queue.length) return;
    syncingRef.current = true;
    let remaining = [...queue];
    for (const entry of remaining) {
      try {
        await call("/bills", { method: "POST", body: JSON.stringify(entry.payload) });
        remaining = remaining.filter((x) => x.localId !== entry.localId);
      } catch (e: any) {
        if (e.status) { remaining = remaining.filter((x) => x.localId !== entry.localId); continue; }
        break;
      }
    }
    syncingRef.current = false;
    await persistQueue(remaining);
    if (!remaining.length) { setOnline(true); refresh(); }
  };

  const maybeRunRecurring = async () => {
    try {
      const due: Recurring[] = await call("/recurring/due");
      if (!due.length) return;
      const key = due.map((d) => d.id).sort().join(",");
      if (promptedRef.current === key) return;
      promptedRef.current = key;
      Alert.alert("Recurring bills due", `${due.length} monthly bill(s) are ready to generate.`, [
        { text: "Later", style: "cancel" },
        { text: "Generate", onPress: async () => { for (const t of due) { try { await call("/bills", { method: "POST", body: JSON.stringify({ customer: t.customer, items: t.items, tax_rate: t.tax_rate, discount: t.discount, discount_type: t.discount_type, payment_mode: t.payment_mode }) }); await call(`/recurring/${t.id}/run`, { method: "PATCH" }); } catch {} } refresh(); } },
      ]);
    } catch {}
  };

  const refresh = async () => {
    try {
      const requests: Promise<any>[] = [call("/dashboard"), call("/products"), call("/bills"), call("/customers"), call("/documents"), call("/profile"), call("/recurring")];
      if (role === "admin") requests.push(call("/users"));
      const [d, p, b, c, v, pr, rec, u] = await Promise.all(requests);
      setDashboard(d); setProducts(p); setBills(b); setCustomers(c); setDocs(v); setProfile(pr); setRecurringList(rec);
      if (u) setUsers(u);
      setOnline(true);
      syncQueue();
      maybeRunRecurring();
    } catch (e: any) {
      if (e.status === 401) { signOut(); return; }
      if (!e.status) { setOnline(false); setLoading(false); return; }
      Alert.alert("Couldn't load data", "Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadQueue(); refresh(); if (Platform.OS === "web") { const up = () => { setOnline(true); syncQueue(); }; window.addEventListener("online", up); return () => window.removeEventListener("online", up); } }, []);

  if (loading) return <SafeAreaView style={styles.loader}><ActivityIndicator color={C.green} size="large" /><Text style={styles.muted}>Opening your workspace…</Text></SafeAreaView>;

  const offlineRows: Bill[] = queue.map((q) => ({ id: `OFF-${q.localId.slice(-4)}`, customer: q.payload.customer, total: computeTotalPreview(q.payload.items, q.payload.tax_rate, q.payload.discount, q.payload.discount_type).total, payment_status: "Waiting", payment_mode: q.payload.payment_mode, created_at: q.created_at, __offline: true, items: q.payload.items }));

  return <SafeAreaView style={styles.safe}>
    {!online && <Pressable onPress={() => { syncQueue(); refresh(); }} style={styles.offlineBar}><Ionicons name="cloud-offline-outline" size={15} color={C.white} /><Text style={styles.offlineText}>Offline — bills save locally & sync automatically</Text><Text style={styles.offlineRetry}>Retry</Text></Pressable>}
    <View style={styles.content}>{tab === "Home" && <Home dashboard={dashboard} bills={bills} offlineCount={queue.length} setTab={setTab} onSelect={(b: any) => { setSelectedBill(b); setEditingBill(null); setTab("Bills"); }} />}{tab === "Bills" && <Bills role={role} products={products} bills={bills} customers={customers} offlineRows={offlineRows} refresh={refresh} selected={selectedBill} setSelected={setSelectedBill} editingBill={editingBill} setEditingBill={setEditingBill} onOfflineSave={enqueueOffline} onDeleteRecurring={async (id: string) => { await call(`/recurring/${id}`, { method: "DELETE" }); refresh(); }} onMakeRecurring={async (bill: any) => { try { await call("/recurring", { method: "POST", body: JSON.stringify({ customer: bill.customer, items: bill.items, tax_rate: bill.tax ?? 0, discount: 0, discount_type: "flat", payment_mode: bill.payment_mode, day_of_month: new Date().getDate() }) }); Alert.alert("Repeats monthly", `${bill.customer}'s bill will be suggested on day ${new Date().getDate()} of every month.`); } catch { Alert.alert("Couldn't set up repeat", "Please try again."); } }} />}{tab === "Vault" && <Vault docs={docs} refresh={refresh} online={online} />}{tab === "Stock" && <Stock products={products} refresh={refresh} />}{tab === "Profile" && <Profile role={role} profile={profile} setProfile={setProfile} refresh={refresh} customers={customers} users={users} recurringList={recurringList} onDeleteRecurring={async (id: string) => { await call(`/recurring/${id}`, { method: "DELETE" }); refresh(); }} signOut={signOut} />}</View>
    <View style={styles.tabs}>{([ ["Home", "grid-outline"], ["Bills", "receipt-outline"], ["Vault", "folder-open-outline"], ["Stock", "cube-outline"], ["Profile", "person-outline"] ] as [Tab, keyof typeof Ionicons.glyphMap][]).map(([name, icon]) => { const active = tab === name; return <Pressable testID={`tab-${name.toLowerCase()}`} key={name} onPress={() => setTab(name)} style={styles.tab}><View style={[styles.tabIconWrap, active && styles.tabIconWrapActive]}><Ionicons name={icon} size={21} color={active ? C.green : C.muted} /></View><Text style={[styles.tabText, active && { color: C.green, fontWeight: "800" }]}>{name}</Text></Pressable>; })}</View>
  </SafeAreaView>;
}

function Header({ title, subtitle }: { title: string; subtitle?: string }) { return <View style={styles.header}><View><Text style={styles.kicker}>EstimateGo</Text><Text style={styles.title}>{title}</Text>{subtitle && <Text style={styles.muted}>{subtitle}</Text>}</View><BrandMark size={44} /></View>; }

function Home({ dashboard, bills, offlineCount, setTab, onSelect }: any) {
  const hr = new Date().getHours();
  const greet = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : hr < 21 ? "Good evening" : "Good night";
  return <ScrollView contentContainerStyle={styles.scroll}><Header title={greet} subtitle="Your wholesale desk at a glance" />
    <LinearGradient colors={[C.green, C.greenDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <Text style={styles.heroLabel}>TODAY'S SALES</Text><Text style={styles.heroAmount}>{money(dashboard?.total_sales || 0)}</Text>
      <View style={styles.heroFoot}><Text style={styles.heroSub}>{dashboard?.bill_count || 0} bills today</Text><View style={styles.up}><Ionicons name="flash" size={13} color={C.white} /><Text style={styles.upTextGold}>Live</Text></View></View>
      <Text style={{ color: "#C9D8C5", fontSize: 11, marginTop: 10 }}>All time: {money(dashboard?.lifetime_sales || 0)} · {dashboard?.lifetime_bill_count || 0} bills</Text>
    </LinearGradient>
    {!!offlineCount && <View style={styles.syncNote}><Ionicons name="sync-circle-outline" size={17} color={C.goldInk} /><Text style={styles.syncNoteText}>{offlineCount} bill(s) waiting to sync</Text></View>}
    <Text style={styles.section}>QUICK ACTIONS</Text><View style={styles.actionRow}><Action icon="add-circle-outline" label="New bill" onPress={() => setTab("Bills")} /><Action icon="cloud-upload-outline" label="Store doc" onPress={() => setTab("Vault")} /><Action icon="cube-outline" label="Add stock" onPress={() => setTab("Stock")} /></View>
    <View style={styles.sectionRow}><Text style={styles.section}>RECENT BILLS</Text><Pressable onPress={() => setTab("Bills")}><Text style={styles.link}>View all</Text></Pressable></View>
    {bills.length ? bills.slice(0, 4).map((b: Bill) => <BillRow key={b.id} bill={b} onPress={() => onSelect(b)} />) : <Empty icon="receipt-outline" text="Your first bill will appear here" />}
  </ScrollView>;
}
function Action({ icon, label, onPress }: any) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.action, pressed && styles.pressed]}><View style={styles.actionIcon}><Ionicons name={icon} size={22} color={C.green} /></View><Text style={styles.actionLabel}>{label}</Text></Pressable>; }
function BillRow({ bill, onPress }: { bill: Bill; onPress?: () => void }) { return <Pressable testID={`bill-row-${bill.id}`} onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}><View style={[styles.rowIcon, bill.__offline && { backgroundColor: C.goldSoft }]}><Ionicons name={bill.__offline ? "cloud-offline-outline" : "document-text-outline"} size={19} color={bill.__offline ? C.goldInk : C.green} /></View><View style={styles.rowMain}><Text style={styles.rowTitle}>{bill.customer}</Text><Text style={styles.rowSub}>{bill.id} · {bill.payment_mode || "Cash"} · Tap to open</Text></View><View style={styles.rowRight}><Text style={styles.rowAmount}>{money(bill.total)}</Text><StatusPill status={bill.payment_status} /></View></Pressable>; }

function Bills({ role, products, bills, customers, offlineRows, refresh, selected, setSelected, editingBill, setEditingBill, onOfflineSave, onMakeRecurring }: any) {
  const [customer, setCustomer] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [tax, setTax] = useState("0");
  const [discVal, setDiscVal] = useState("");
  const [discType, setDiscType] = useState<"flat" | "percent">("flat");
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [customQty, setCustomQty] = useState("1");
  const [payMode, setPayMode] = useState("Cash");
  const [saveCust, setSaveCust] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    if (editingBill) {
      setCustomer(editingBill.customer || "");
      setItems((editingBill.items || []).map((x: any) => ({ ...x })));
      setTax(String(editingBill.tax ?? 0));
      setDiscVal(String(editingBill.discount ?? ""));
      setDiscType(editingBill.discount_type === "percent" ? "percent" : "flat");
      setPayMode(editingBill.payment_mode || "Cash");
    }
  }, [editingBill]);

  const isEditing = !!editingBill;
  const query = customer.trim().toLowerCase();
  const suggestions = query ? customers.filter((c: Customer) => c.name.toLowerCase().includes(query) && c.name.toLowerCase() !== query).slice(0, 4) : [];
  const known = customers.find((c: Customer) => c.name.toLowerCase() === query);
  const preview = computeTotalPreview(items, Number(tax), Number(discVal) || 0, discType);

  const addCustom = () => { if (!customName.trim() || !Number(customPrice)) return Alert.alert("Add item details", "Enter an item name and price first."); setItems((old) => [...old, { name: customName.trim(), price: Number(customPrice), quantity: Number(customQty) || 1 }]); setCustomName(""); setCustomPrice(""); setCustomQty("1"); };
  const addProduct = (p: Product) => { setItems((old) => [...old, { productId: p.id, name: p.name, price: p.price, quantity: 1 }]); if (p.stock <= 3) Alert.alert("Low stock", `Only ${p.stock} ${p.unit} of ${p.name} left in stock.`); };
  const resetForm = () => { setCustomer(""); setItems([]); setTax("0"); setDiscVal(""); setDiscType("flat"); setPayMode("Cash"); setSaveCust(true); };
  const afterSave = (bill: any, wasEdit: boolean) => Alert.alert(wasEdit ? "Bill updated" : "Bill saved automatically", `${bill.id} is stored in your bills.`, [{ text: "Share", onPress: () => shareEstimate(bill) }, { text: "Print", onPress: () => printEstimate(bill) }, { text: "Done", style: "cancel" }]);
  const save = async () => {
    if (!customer.trim() || !items.length) return Alert.alert("Almost ready", "Add a customer and at least one product.");
    const payload = { customer, items, tax_rate: Number(tax), discount: Number(discVal) || 0, discount_type: discType, payment_mode: payMode };
    try {
      let bill: any;
      if (isEditing) { bill = await call(`/bills/${editingBill.id}`, { method: "PUT", body: JSON.stringify(payload) }); setEditingBill(null); }
      else {
        bill = await call("/bills", { method: "POST", body: JSON.stringify(payload) });
        if (saveCust && !known) { try { await call("/customers", { method: "POST", body: JSON.stringify({ name: customer }) }); } catch {} }
      }
      resetForm();
      refresh();
      afterSave(bill, isEditing);
    } catch (e: any) {
      if (!e.status && !isEditing) { await onOfflineSave(payload); resetForm(); return; }
      Alert.alert(isEditing ? "Couldn't update bill" : "Couldn't save bill", !e.status ? "You seem offline while editing — edits need internet." : e.status === 403 ? "Only admin can edit bills." : "Please try again.");
    }
  };

  const shown = bills.filter((b: Bill) => statusFilter === "All" || b.payment_status === statusFilter).filter((b: Bill) => { const q = search.trim().toLowerCase(); return !q || b.customer.toLowerCase().includes(q) || b.id.toLowerCase().includes(q); });

  if (selected) return <BillDetail role={role} bill={selected} onBack={() => setSelected(null)} onStatus={async (status: string) => { await call(`/bills/${selected.id}/status`, { method: "PATCH", body: JSON.stringify({ payment_status: status }) }); setSelected({ ...selected, payment_status: status }); refresh(); }} onDelete={async (bill: any) => { await call(`/bills/${bill.id}`, { method: "DELETE" }); setSelected(null); refresh(); }} onEdit={(bill: any) => { setSelected(null); setEditingBill(bill); }} onMakeRecurring={onMakeRecurring} />;

  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}><ScrollView contentContainerStyle={styles.scroll}>
    <Header title={isEditing ? `Edit ${editingBill.id}` : "New bill"} subtitle={isEditing ? "Change items, then save" : "Build an estimate in a few taps"} />
    {isEditing && <Pressable onPress={() => { setEditingBill(null); resetForm(); }} style={styles.back}><Ionicons name="close-circle-outline" size={20} color={C.red} /><Text style={[styles.link, { color: C.red }]}>Cancel editing</Text></Pressable>}
    <Text style={styles.label}>CUSTOMER NAME</Text>
    <TextInput testID="bill-customer" value={customer} onChangeText={setCustomer} placeholder="e.g. Sharma Wholesale" placeholderTextColor="#9AA29B" style={styles.input} />
    {suggestions.length > 0 && <View style={styles.sugWrap}>{suggestions.map((c: Customer) => <Pressable key={c.id} style={styles.sugRow} onPress={() => setCustomer(c.name)}><Text style={styles.rowTitle}>{c.name}</Text><Text style={styles.link}>Pick</Text></Pressable>)}</View>}
    {known && !!known.dues && <View style={styles.duesWarn}><Ionicons name="alert-circle-outline" size={16} color={C.red} /><Text style={styles.duesWarnText}>Owes {money(known.dues)} across {known.open_bills} unpaid bill(s)</Text></View>}
    {!isEditing && !known && !!query && <Pressable style={styles.checkRow} onPress={() => setSaveCust(!saveCust)}><Ionicons name={saveCust ? "checkbox-outline" : "square-outline"} size={20} color={saveCust ? C.green : C.muted} /><Text style={styles.muted}>Save "{customer.trim()}" to customer list</Text></Pressable>}
    {!isEditing && products.length > 0 && <View><Text style={styles.label}>FROM STOCK · TAP TO ADD</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>{products.map((p: Product) => <Pressable key={p.id} style={({ pressed }) => [styles.productChip, pressed && styles.pressed]} onPress={() => addProduct(p)}><Text style={styles.chipText}>{p.name}</Text><Text style={styles.chipPrice}>{money(p.price)} · {p.stock} left</Text></Pressable>)}</ScrollView></View>}
    <Text style={styles.label}>ADD YOUR OWN ITEM</Text>
    <View style={styles.customRow}><TextInput testID="custom-item-name" value={customName} onChangeText={setCustomName} placeholder="Item name" placeholderTextColor="#9AA29B" style={styles.customName} /><TextInput testID="custom-item-price" value={customPrice} onChangeText={setCustomPrice} placeholder="Price" keyboardType="numeric" placeholderTextColor="#9AA29B" style={styles.customInput} /><TextInput testID="custom-item-qty" value={customQty} onChangeText={setCustomQty} placeholder="Qty" keyboardType="numeric" placeholderTextColor="#9AA29B" style={styles.customInput} /><Pressable testID="add-custom-item" onPress={addCustom} style={styles.addSmall}><Ionicons name="add" size={20} color={C.white} /></Pressable></View>
    {items.map((x, idx) => <View style={styles.itemLine} key={`${x.name}-${idx}`}><View style={styles.itemMain}><Text style={styles.serialNo}>{idx + 1}.</Text><View><Text style={styles.rowTitle}>{x.name}</Text><Text style={styles.rowSub}>{x.quantity} × {money(x.price)}</Text></View></View><Pressable onPress={() => setItems(items.filter((_, i) => i !== idx))} hitSlop={10}><Ionicons name="trash-outline" size={17} color={C.red} /></Pressable><Text style={[styles.rowAmount, { minWidth: 74, textAlign: "right" }]}>{money(x.quantity * x.price)}</Text></View>)}
    <Text style={styles.label}>PAYMENT MODE</Text>
    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>{["Cash", "UPI", "Card", "Credit"].map((m) => <Pressable key={m} onPress={() => setPayMode(m)} style={[styles.filter, payMode === m && styles.filterActive]}><Text style={[styles.filterText, payMode === m && { color: C.white }]}>{m}</Text></Pressable>)}</View>
    <View style={[styles.totalCard, styles.cardShadow]}>
      <View style={styles.totalLine}><Text style={styles.muted}>Subtotal</Text><Text testID="bill-subtotal" style={styles.rowTitle}>{money(preview.subtotal)}</Text></View>
      <View style={styles.totalLine}><Text style={styles.muted}>Discount</Text><View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>{["flat", "percent"].map((t) => <Pressable key={t} onPress={() => setDiscType(t as any)} style={[styles.miniChip, discType === t && styles.miniChipActive]}><Text style={[styles.miniChipText, discType === t && { color: C.white }]}>{t === "flat" ? "₹" : "%"}</Text></Pressable>)}<TextInput testID="bill-discount" value={discVal} onChangeText={setDiscVal} keyboardType="numeric" placeholder="0" placeholderTextColor="#9AA29B" style={styles.taxInput} /></View></View>
      {preview.discountAmount > 0 && <View style={styles.totalLine}><Text style={{ color: C.red, fontSize: 13, fontWeight: "700" }}>Discount applied</Text><Text style={{ color: C.red, fontSize: 13, fontWeight: "800" }}>− {money(preview.discountAmount)}</Text></View>}
      <View style={styles.totalLine}><Text style={styles.muted}>Tax %</Text><TextInput testID="bill-tax" value={tax} onChangeText={setTax} keyboardType="numeric" style={styles.taxInput} /></View>
      <View style={[styles.totalLine, { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12 }]}><Text style={styles.totalText}>Total</Text><Text testID="bill-total" style={[styles.totalText, { color: C.green }]}>{money(preview.total)}</Text></View>
    </View>
    <Pressable testID="save-bill" onPress={save} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}><Ionicons name="checkmark-circle-outline" size={20} color={C.white} /><Text style={styles.primaryText}>{isEditing ? "Save changes" : "Save & generate bill"}</Text></Pressable>
    {offlineRows.length > 0 && <View><Text style={styles.section}>WAITING TO SYNC</Text>{offlineRows.map((b) => <BillRow key={b.id} bill={b} onPress={() => setSelected(b)} />)}</View>}
    <View style={styles.sectionRow}><Text style={styles.section}>ALL BILLS · TAP TO OPEN</Text><Text style={styles.muted}>{shown.length} of {bills.length}</Text></View>
    <TextInput testID="bill-search" value={search} onChangeText={setSearch} placeholder="Search by customer or bill no…" placeholderTextColor="#9AA29B" style={styles.input} />
    <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>{["All", "Pending", "Paid"].map((s) => <Pressable key={s} onPress={() => setStatusFilter(s)} style={[styles.filter, statusFilter === s && styles.filterActive]}><Text style={[styles.filterText, statusFilter === s && { color: C.white }]}>{s}</Text></Pressable>)}</View>
    {shown.length ? shown.map((b: Bill) => <BillRow key={b.id} bill={b} onPress={() => setSelected(b)} />) : <Empty icon="search-outline" text={bills.length ? "No bills match your search" : "No saved bills yet"} />}
  </ScrollView></KeyboardAvoidingView>;
}

function BillDetail({ role, bill, onBack, onStatus, onDelete, onEdit, onMakeRecurring }: any) {
  const isAdmin = role === "admin";
  const confirmDelete = () => Alert.alert("Delete this bill?", `${bill.id} for ${bill.customer} will be removed and its items returned to stock.`, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => onDelete(bill) }]);
  return <ScrollView contentContainerStyle={styles.scroll}>
    <Pressable onPress={onBack} style={styles.back}><Ionicons name="arrow-back" size={20} color={C.green} /><Text style={styles.link}>Back to bills</Text></Pressable>
    <Header title={bill.id} subtitle={`Customer · ${bill.customer}`} />
    <View style={[styles.detailCard, styles.cardShadow]}>
      <View style={styles.sectionRow}><Text style={styles.section}>PAYMENT STATUS</Text><StatusPill status={bill.__offline ? "Waiting" : bill.payment_status} /></View>
      <Text style={styles.detailTotal}>{money(bill.total)}</Text>
      <View style={styles.metaRow}>
        <View style={styles.metaChip}><Text style={styles.metaChipText}>{bill.payment_mode || "Cash"}</Text></View>
        {!!bill.discount_amount && <View style={[styles.metaChip, { backgroundColor: C.redSoft }]}><Text style={[styles.metaChipText, { color: C.red }]}>−{money(bill.discount_amount)}</Text></View>}
        {!!bill.created_by && <View style={styles.metaChip}><Text style={styles.metaChipText}>by {bill.created_by}</Text></View>}
        <View style={styles.metaChip}><Text style={styles.metaChipText}>{new Date(bill.created_at).toLocaleDateString("en-IN")}</Text></View>
      </View>
      {(bill.items || []).map((item: any, i: number) => <View key={`${item.name}-${i}`} style={styles.itemLine}><View style={styles.itemMain}><Text style={styles.serialNo}>{i + 1}.</Text><Text style={styles.rowTitle}>{item.name} × {item.quantity}</Text></View><Text style={styles.rowAmount}>{money(item.price * item.quantity)}</Text></View>)}
    </View>
    {bill.__offline ? <>
      <View style={styles.duesWarn}><Ionicons name="cloud-offline-outline" size={16} color={C.goldInk} /><Text style={[styles.duesWarnText, { color: C.goldInk }]}>Saved offline — syncs automatically when back online.</Text></View>
      <Pressable testID="detail-print-offline" onPress={() => printEstimate(bill)} style={styles.primary}><Ionicons name="print-outline" size={20} color={C.white} /><Text style={styles.primaryText}>Print estimate</Text></Pressable>
    </> : <>
      <Text style={styles.section}>UPDATE STATUS</Text>
      <View style={styles.statusButtons}><Pressable testID="mark-pending" onPress={() => onStatus("Pending")} style={[styles.statusButton, bill.payment_status === "Pending" && styles.statusButtonActive]}><Text style={[styles.statusButtonText, bill.payment_status === "Pending" && { color: C.white }]}>Pending</Text></Pressable><Pressable testID="mark-paid" onPress={() => onStatus("Paid")} style={[styles.statusButton, bill.payment_status === "Paid" && styles.statusButtonActive]}><Text style={[styles.statusButtonText, bill.payment_status === "Paid" && { color: C.white }]}>Paid</Text></Pressable></View>
      <Pressable testID="detail-print" onPress={() => printEstimate(bill)} style={styles.primary}><Ionicons name="print-outline" size={20} color={C.white} /><Text style={styles.primaryText}>Print bill</Text></Pressable>
      <Pressable testID="detail-recurring" onPress={() => onMakeRecurring(bill)} style={styles.secondary}><Ionicons name="repeat-outline" size={18} color={C.green} /><Text style={styles.secondaryText}>Repeat every month</Text></Pressable>
      {isAdmin ? <View style={styles.btnRow}><Pressable testID="detail-edit" onPress={() => onEdit(bill)} style={[styles.secondary, { flex: 1, marginBottom: 0 }]}><Ionicons name="create-outline" size={18} color={C.green} /><Text style={styles.secondaryText}>Edit bill</Text></Pressable><Pressable testID="detail-delete" onPress={confirmDelete} style={[styles.secondary, styles.dangerBtn, { flex: 1, marginBottom: 0 }]}><Ionicons name="trash-outline" size={18} color={C.red} /><Text style={[styles.secondaryText, { color: C.red }]}>Delete</Text></Pressable></View> : <Text style={styles.note}>Ask an admin to edit or delete bills.</Text>}
    </>}
  </ScrollView>;
}

function Vault({ docs, refresh, online }: any) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Bills");
  const cats = ["Bills", "Invoices", "Receipts", "Purchase Orders", "Supplier Docs", "Customer Docs", "Tax Docs", "Other"];
  const add = async () => { if (!name.trim()) return Alert.alert("Name needed", "Give this document a name."); try { await call("/documents", { method: "POST", body: JSON.stringify({ name, category }) }); setName(""); refresh(); } catch (e: any) { if (!e.status) return Alert.alert("You're offline", "Documents need internet — bills can still save offline."); Alert.alert("Couldn't store document", "Please try again."); } };
  const exportCsv = async () => {
    if (Platform.OS === "web") {
      try {
        const r = await fetch(`${API}/export/bills.csv`, { headers: { Authorization: `Bearer ${AUTH}` } });
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "estimatego-bills.csv"; a.click();
        URL.revokeObjectURL(url);
      } catch { Alert.alert("Export failed", "Please try again."); }
    } else {
      Linking.openURL(`${API}/export/bills.csv?token=${AUTH}`);
    }
  };
  return <ScrollView contentContainerStyle={styles.scroll}><Header title="Document vault" subtitle="Everything organized, category wise" /><TextInput testID="document-name" value={name} onChangeText={setName} placeholder="Document name" placeholderTextColor="#9AA29B" style={styles.input} /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 18 }}>{cats.map(c => <Pressable key={c} onPress={() => setCategory(c)} style={[styles.filter, category === c && styles.filterActive]}><Text style={[styles.filterText, category === c && { color: C.white }]}>{c}</Text></Pressable>)}</ScrollView><Pressable testID="store-document" onPress={add} disabled={!online} style={[styles.secondary, !online && { opacity: 0.5 }]}><Ionicons name="cloud-upload-outline" size={19} color={C.green} /><Text style={styles.secondaryText}>Store document</Text></Pressable><Pressable testID="export-csv" onPress={exportCsv} style={styles.secondary}><Ionicons name="download-outline" size={19} color={C.green} /><Text style={styles.secondaryText}>Export sales as CSV</Text></Pressable><Text style={styles.section}>SAVED DOCUMENTS</Text>{docs.length ? docs.map(d => <View key={d.id} style={styles.row}><View style={[styles.rowIcon, { backgroundColor: "#F0E8E1" }]}><Ionicons name="folder-open-outline" size={19} color="#8B5E3C" /></View><View style={styles.rowMain}><Text style={styles.rowTitle}>{d.name}</Text><Text style={styles.rowSub}>{d.category}</Text></View><Ionicons name="ellipsis-horizontal" size={20} color={C.muted} /></View>) : <Empty icon="folder-open-outline" text="No documents saved yet" />}</ScrollView>;
}

function Stock({ products, refresh }: any) { const [name, setName] = useState(""); const [price, setPrice] = useState(""); const [stock, setStock] = useState(""); const add = async () => { if (!name.trim()) return Alert.alert("Name needed", "Add a product name."); try { await call("/products", { method: "POST", body: JSON.stringify({ name, price: Number(price) || 0, stock: Number(stock) || 0 }) }); setName(""); setPrice(""); setStock(""); refresh(); } catch (e: any) { if (!e.status) return Alert.alert("You're offline", "Stock changes need internet — bills can still save offline."); Alert.alert("Couldn't add item", "Please try again."); } }; return <ScrollView contentContainerStyle={styles.scroll}><Header title="Inventory" subtitle="Stock reduces automatically when billed" /><View style={styles.formGrid}><TextInput testID="product-name" value={name} onChangeText={setName} placeholder="Product name" placeholderTextColor="#9AA29B" style={[styles.input, { flex: 2 }]} /><TextInput value={price} onChangeText={setPrice} placeholder="Price" keyboardType="numeric" placeholderTextColor="#9AA29B" style={styles.inputSmall} /><TextInput value={stock} onChangeText={setStock} placeholder="Stock" keyboardType="numeric" placeholderTextColor="#9AA29B" style={styles.inputSmall} /></View><Pressable testID="add-product" onPress={add} style={styles.secondary}><Ionicons name="add" size={20} color={C.green} /><Text style={styles.secondaryText}>Add inventory item</Text></Pressable><Text style={styles.section}>PRODUCT CATALOG</Text>{products.length ? products.map(p => <View key={p.id} style={styles.row}><View style={styles.rowIcon}><Ionicons name="cube-outline" size={19} color={C.green} /></View><View style={styles.rowMain}><Text style={styles.rowTitle}>{p.name}</Text><Text style={styles.rowSub}>{money(p.price)} · {p.stock} {p.unit}</Text></View><Text style={[styles.stock, p.stock < 10 && { color: C.red }]}>{p.stock < 10 ? "Low" : "In stock"}</Text></View>) : <Empty icon="cube-outline" text="Add your first product" />}</ScrollView>; }

function Profile({ role, profile, setProfile, refresh, customers, users, recurringList, onDeleteRecurring, signOut }: any) {
  const isAdmin = role === "admin";
  const [newUser, setNewUser] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newRole, setNewRole] = useState("staff");
  const save = async () => { try { await call("/profile", { method: "PUT", body: JSON.stringify(profile) }); Alert.alert("Profile saved", "Your business details are stored."); refresh(); } catch (e: any) { Alert.alert("Couldn't save profile", e.status === 403 ? "Only admin can edit business details." : "Please try again."); } };
  const addUser = async () => { try { await call("/users", { method: "POST", body: JSON.stringify({ username: newUser, password: newPass, role: newRole }) }); setNewUser(""); setNewPass(""); refresh(); Alert.alert("Account created", `${newUser} can now sign in.`); } catch (e: any) { Alert.alert("Couldn't create account", e.status === 400 ? "Username taken or password too short (4+ chars)." : "Please try again."); } };
  const removeRecurring = (r: Recurring) => Alert.alert("Stop this repeating bill?", `${r.customer} · ${money(r.amount)} every month. Past bills stay.`, [{ text: "Cancel", style: "cancel" }, { text: "Stop", style: "destructive", onPress: () => onDeleteRecurring(r.id) }]);
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}><ScrollView contentContainerStyle={styles.scroll}>
    <Header title="Business profile" subtitle={`Signed in as ${role}`} />
    <Text style={styles.label}>BUSINESS NAME</Text><TextInput testID="business-name" editable={isAdmin} value={profile.name} onChangeText={(v) => setProfile({ ...profile, name: v })} placeholder="Your wholesale business" placeholderTextColor="#9AA29B" style={styles.input} />
    <Text style={styles.label}>ADDRESS</Text><TextInput editable={isAdmin} value={profile.address} onChangeText={(v) => setProfile({ ...profile, address: v })} placeholder="Business address" placeholderTextColor="#9AA29B" style={[styles.input, { minHeight: 70 }]} multiline />
    <Text style={styles.label}>PHONE</Text><TextInput editable={isAdmin} value={profile.phone} onChangeText={(v) => setProfile({ ...profile, phone: v })} placeholder="Phone number" keyboardType="phone-pad" placeholderTextColor="#9AA29B" style={styles.input} />
    <Text style={styles.label}>GST / TAX ID</Text><TextInput editable={isAdmin} value={profile.tax_id} onChangeText={(v) => setProfile({ ...profile, tax_id: v })} placeholder="Optional" placeholderTextColor="#9AA29B" style={styles.input} />
    {isAdmin ? <Pressable testID="save-profile" onPress={save} style={styles.primary}><Ionicons name="save-outline" size={20} color={C.white} /><Text style={styles.primaryText}>Save business details</Text></Pressable> : <Text style={styles.note}>Only admin can change business details.</Text>}
    <Text style={styles.section}>CUSTOMERS & DUES</Text>
    {customers.length ? customers.map((c: Customer) => <View key={c.id} style={styles.row}><View style={styles.rowIcon}><Ionicons name="people-outline" size={19} color={C.green} /></View><View style={styles.rowMain}><Text style={styles.rowTitle}>{c.name}</Text><Text style={styles.rowSub}>{c.phone || "No phone"}</Text></View><View style={styles.rowRight}><Text style={[styles.stock, !!c.dues && { color: C.red }]}>{c.dues ? `Owes ${money(c.dues)}` : "Settled"}</Text></View></View>) : <Empty icon="people-outline" text="Saved customers appear here" />}
    <Text style={styles.section}>RECURRING BILLS</Text>
    {recurringList.length ? recurringList.map((r: Recurring) => <View key={r.id} style={styles.row}><View style={[styles.rowIcon, { backgroundColor: C.goldSoft }]}><Ionicons name="repeat-outline" size={19} color={C.goldInk} /></View><View style={styles.rowMain}><Text style={styles.rowTitle}>{r.customer}</Text><Text style={styles.rowSub}>{money(r.amount)} · day {r.day_of_month} · next {new Date(r.next_run).toLocaleDateString("en-IN")}</Text></View>{isAdmin && <Pressable testID={`remove-recurring-${r.id}`} onPress={() => removeRecurring(r)} hitSlop={8}><Ionicons name="trash-outline" size={17} color={C.red} /></Pressable>}</View>) : <Empty icon="repeat-outline" text="Open a bill and tap Repeat to automate it" />}
    {isAdmin && <View><Text style={styles.section}>TEAM ACCOUNTS</Text>
      {users.map((u: User) => <View key={u.id} style={styles.row}><View style={styles.rowIcon}><Ionicons name={u.role === "admin" ? "shield-checkmark-outline" : "person-outline"} size={19} color={C.green} /></View><View style={styles.rowMain}><Text style={styles.rowTitle}>{u.username}</Text><Text style={styles.rowSub}>{u.role === "admin" ? "Full control" : "Billing only"}</Text></View></View>)}
      <Text style={styles.label}>ADD STAFF ACCOUNT</Text>
      <TextInput testID="new-user-name" value={newUser} onChangeText={setNewUser} autoCapitalize="none" placeholder="Username" placeholderTextColor="#9AA29B" style={styles.input} />
      <TextInput testID="new-user-pass" value={newPass} onChangeText={setNewPass} secureTextEntry placeholder="Password (4+ characters)" placeholderTextColor="#9AA29B" style={styles.input} />
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>{["staff", "admin"].map(r => <Pressable key={r} onPress={() => setNewRole(r)} style={[styles.filter, newRole === r && styles.filterActive]}><Text style={[styles.filterText, newRole === r && { color: C.white }]}>{r === "staff" ? "Staff" : "Admin"}</Text></Pressable>)}</View>
      <Pressable testID="create-user" onPress={addUser} style={styles.secondary}><Ionicons name="person-add-outline" size={19} color={C.green} /><Text style={styles.secondaryText}>Create account</Text></Pressable></View>}
    <Pressable testID="sign-out" onPress={signOut} style={[styles.secondary, styles.dangerBtn]}><Ionicons name="log-out-outline" size={19} color={C.red} /><Text style={[styles.secondaryText, { color: C.red }]}>Sign out</Text></Pressable>
  </ScrollView></KeyboardAvoidingView>;
}
function Empty({ icon, text }: { icon: any; text: string }) { return <View style={styles.empty}><Ionicons name={icon} size={34} color={C.green} /><Text style={styles.emptyText}>{text}</Text></View>; }

const shadow = { shadowColor: "#1A1D1A", shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 } as const;
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg }, content: { flex: 1 }, loader: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, backgroundColor: C.bg }, scroll: { padding: 20, paddingBottom: 36 },
  cardShadow: { shadowColor: "#1A1D1A", shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  decoCircleA: { position: "absolute", top: -60, right: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: C.pale, opacity: 0.6 }, decoCircleB: { position: "absolute", bottom: -80, left: -70, width: 240, height: 240, borderRadius: 120, backgroundColor: C.goldSoft, opacity: 0.5 },
  brandTitle: { fontSize: 30, fontWeight: "800", color: C.ink, letterSpacing: -0.6, marginTop: 14 }, formCard: { ...shadow, backgroundColor: C.white, borderRadius: 18, padding: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }, kicker: { fontSize: 11, letterSpacing: 1.5, color: C.green, fontWeight: "800", marginBottom: 7 }, title: { fontSize: 30, color: C.ink, fontWeight: "800", letterSpacing: -0.8 }, muted: { color: C.muted, fontSize: 14 },
  hero: { borderRadius: 22, padding: 22, marginBottom: 20, ...shadow }, heroLabel: { color: "#C9D8C5", fontSize: 11, fontWeight: "800", letterSpacing: 1.4 }, heroAmount: { color: C.white, fontSize: 38, fontWeight: "800", marginTop: 8 }, heroFoot: { flexDirection: "row", justifyContent: "space-between", marginTop: 18, alignItems: "center" }, heroSub: { color: "#DDE8DA", fontSize: 13 }, up: { backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 99, paddingVertical: 6, paddingHorizontal: 10, flexDirection: "row", gap: 4, alignItems: "center" }, upTextGold: { color: C.gold, fontSize: 12, fontWeight: "800" },
  syncNote: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.goldSoft, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 20 }, syncNoteText: { color: C.goldInk, fontSize: 12, fontWeight: "700" },
  offlineBar: { backgroundColor: C.red, flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, paddingHorizontal: 14 }, offlineText: { color: C.white, fontSize: 12, fontWeight: "700", flex: 1 }, offlineRetry: { color: C.white, fontSize: 12, fontWeight: "800", textDecorationLine: "underline" },
  section: { color: C.muted, fontSize: 11, letterSpacing: 1.3, fontWeight: "800", marginBottom: 13, marginTop: 4 }, actionRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 28 }, action: { alignItems: "center", width: "31%", gap: 8 }, actionIcon: { backgroundColor: C.pale, width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" }, actionLabel: { fontSize: 13, color: C.ink, fontWeight: "600" },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, link: { color: C.green, fontWeight: "700", fontSize: 13 }, back: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line, minHeight: 70 }, rowIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: C.pale, alignItems: "center", justifyContent: "center", marginRight: 12 }, rowMain: { flex: 1 }, rowTitle: { fontSize: 15, color: C.ink, fontWeight: "700" }, rowSub: { color: C.muted, fontSize: 12, marginTop: 4 }, serialNo: { color: C.muted, fontSize: 13, fontWeight: "800", minWidth: 22 }, itemMain: { flexDirection: "row", alignItems: "center", flex: 1, gap: 10 }, rowRight: { alignItems: "flex-end" }, rowAmount: { color: C.ink, fontWeight: "800", fontSize: 15 },
  pill: { borderRadius: 99, paddingVertical: 4, paddingHorizontal: 9, marginTop: 4 }, pillText: { fontSize: 11, fontWeight: "800" },
  detailCard: { backgroundColor: C.card, borderRadius: 18, padding: 18, marginBottom: 20 }, detailTotal: { fontSize: 30, color: C.ink, fontWeight: "800", marginBottom: 10 }, metaRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 12 }, metaChip: { backgroundColor: C.pale, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 }, metaChipText: { color: C.green, fontSize: 11, fontWeight: "800" },
  statusButtons: { flexDirection: "row", gap: 10, marginBottom: 10 }, statusButton: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.card }, statusButtonActive: { backgroundColor: C.green, borderColor: C.green }, statusButtonText: { color: C.muted, fontWeight: "800" },
  tabs: { height: 78, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: "rgba(251,251,250,0.97)", flexDirection: "row", justifyContent: "space-around", paddingTop: 8 }, tab: { alignItems: "center", gap: 2, minWidth: 54 }, tabIconWrap: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 14 }, tabIconWrapActive: { backgroundColor: C.pale }, tabText: { fontSize: 11, color: C.muted }, pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 1.1, color: C.muted, marginTop: 12, marginBottom: 8 }, input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 12, minHeight: 50, paddingHorizontal: 14, paddingVertical: 12, color: C.ink, fontSize: 15, marginBottom: 6 }, inputSmall: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 12, minHeight: 50, paddingHorizontal: 10, color: C.ink, fontSize: 14, flex: 1 },
  customRow: { flexDirection: "row", gap: 7, alignItems: "center", marginBottom: 10 }, customName: { flex: 2, minWidth: 0, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 12, minHeight: 48, paddingHorizontal: 9, color: C.ink }, customInput: { flex: 1, minWidth: 0, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 12, minHeight: 48, paddingHorizontal: 6, color: C.ink }, addSmall: { width: 48, height: 48, borderRadius: 12, backgroundColor: C.green, alignItems: "center", justifyContent: "center" }, formGrid: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 12 },
  productChip: { ...shadow, backgroundColor: C.white, borderColor: C.line, borderWidth: 1, borderRadius: 14, padding: 12, minWidth: 130, gap: 4 }, chipText: { color: C.ink, fontWeight: "700", fontSize: 13 }, chipPrice: { color: C.muted, fontSize: 12 },
  itemLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line },
  totalCard: { backgroundColor: C.card, padding: 16, borderRadius: 16, marginTop: 18, marginBottom: 18, gap: 14 }, totalLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, totalText: { fontSize: 18, fontWeight: "800", color: C.ink }, taxInput: { backgroundColor: C.white, width: 70, borderRadius: 8, padding: 8, textAlign: "right", color: C.ink }, miniChip: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8, backgroundColor: C.white, borderWidth: 1, borderColor: C.line }, miniChipActive: { backgroundColor: C.green, borderColor: C.green }, miniChipText: { color: C.muted, fontSize: 12, fontWeight: "800" },
  primary: { ...shadow, minHeight: 52, borderRadius: 15, backgroundColor: C.green, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 14 }, primaryText: { color: C.white, fontWeight: "800", fontSize: 15 }, secondary: { minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: C.green, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginBottom: 24, marginTop: 10 }, secondaryText: { color: C.green, fontWeight: "800", fontSize: 15 },
  filter: { borderRadius: 99, backgroundColor: C.card, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: C.line }, filterActive: { backgroundColor: C.green, borderColor: C.green }, filterText: { color: C.muted, fontSize: 12, fontWeight: "700" }, stock: { color: C.green, fontSize: 12, fontWeight: "700" }, empty: { alignItems: "center", paddingVertical: 50, gap: 12 }, emptyText: { color: C.muted, fontSize: 14 },
  logoCircle: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.green, alignItems: "center", justifyContent: "center", marginBottom: 12 }, note: { color: C.muted, fontSize: 12, marginTop: 8 }, btnRow: { flexDirection: "row", gap: 10, marginTop: 14, marginBottom: 10 }, quickBtn: { flex: 1, minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: C.green, alignItems: "center", justifyContent: "center" }, quickBtnText: { color: C.green, fontWeight: "800", fontSize: 13 },
  hintCard: { ...shadow, backgroundColor: C.white, borderRadius: 16, padding: 16, marginTop: 26 },
  sugWrap: { ...shadow, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 12, overflow: "hidden", marginBottom: 8 }, sugRow: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.line, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, checkRow: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 8 }, duesWarn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.redSoft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 }, duesWarnText: { color: C.red, fontSize: 12, fontWeight: "700" }, dangerBtn: { borderColor: C.red },
});
