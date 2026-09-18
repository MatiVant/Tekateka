"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { useState } from "react";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("visitor");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      if (role === 'organizer') {
        const confirmed = window.confirm(
          '⚠️ Registro de Organizador\n\n' +
          'Tu cuenta quedará pendiente de aprobación por un administrador.\n' +
          'Recibirás un email cuando tu cuenta sea aprobada.\n' +
          'Una vez aprobado, podrás crear 1 evento gratis.\n\n' +
          '¿Deseas continuar?'
        );
        if (!confirmed) {
          setIsLoading(false);
          return;
        }
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo:
            process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
            `${window.location.origin}/`,
          data: {
            full_name: fullName,
            role: role,
          },
        },
      });
      if (error) throw error;
      
      if (role === 'organizer') {
        router.push("/auth/sign-up-success?organizer=true");
      } else {
        router.push("/auth/sign-up-success");
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Error al registrarse");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-[#f4eddf] px-5 py-8 text-[#171717] sm:px-8 sm:py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center sm:mb-10">
          <Link href="/" className="inline-block text-[2.25rem] font-black tracking-[-0.08em] text-[#171717] sm:text-[2.75rem]">Te<span className="text-[#f4511e]">k</span>aTeka</Link>
          <p className="mt-2 text-[0.65rem] font-semibold uppercase tracking-[0.32em] text-[#6b6258]">Más cultura. Más encuentros.</p>
        </div>
        <Card className="rounded-[1.75rem] border-[#e7dcc8] bg-[#fffdf7] shadow-[0_18px_50px_rgba(78,59,38,0.12)]">
          <CardHeader className="px-6 pb-2 pt-7 sm:px-8 sm:pt-8">
            <CardTitle className="text-[1.8rem] tracking-[-0.04em]">Crear cuenta</CardTitle>
            <CardDescription className="mt-1 text-[#6b6258]">
              Guardá tus entradas y descubrí nuevos eventos.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-7 pt-5 sm:px-8 sm:pb-8">
            <form onSubmit={handleSignUp}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="fullName">Nombre Completo</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Juan Pérez"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="role">Tipo de Usuario</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="visitor">Visitante (Comprar Entradas)</SelectItem>
                      <SelectItem value="organizer">Organizador (Gestionar Eventos)</SelectItem>
                      <SelectItem value="ticketero">Ticketero (Verificar Entradas)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Creando cuenta..." : "Crear Cuenta"}
                </Button>
              </div>
              <div className="mt-4 text-center text-sm text-muted-foreground">
                ¿Ya tienes cuenta?{" "}
                <Link
                  href="/auth/login"
                  className="underline underline-offset-4 text-foreground hover:text-primary"
                >
                  Iniciar Sesión
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
