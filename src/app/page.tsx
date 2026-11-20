import { LobbyForm } from "@/components/lobby/LobbyForm";

export default function HomePage() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#071018] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 20% -10%, rgba(45,212,191,0.28), transparent 55%), radial-gradient(ellipse 60% 45% at 90% 10%, rgba(56,189,248,0.18), transparent 50%), radial-gradient(ellipse 50% 40% at 50% 100%, rgba(15,118,110,0.22), transparent 55%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2394a3b8' fill-opacity='0.08'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      />

      <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-6xl flex-col justify-center gap-10 px-5 py-14 lg:flex-row lg:items-center lg:gap-16 lg:px-8">
        <section className="max-w-xl animate-in fade-in slide-in-from-bottom-3 duration-700">
          <p className="mb-4 font-[family-name:var(--font-display)] text-5xl leading-none tracking-tight text-teal-300 sm:text-6xl md:text-7xl">
            FunCall
          </p>
          <h1 className="max-w-md text-2xl font-medium leading-snug text-slate-100 sm:text-3xl">
            Meet face-to-face. Switch on cat ears whenever you want.
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-slate-400">
            Instant video rooms with live face filters. Everyone in the call
            sees your filter change in real time — no installs, just a link.
          </p>
        </section>

        <section className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
          <LobbyForm />
        </section>
      </main>
    </div>
  );
}
