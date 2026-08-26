import { toast } from "@/hooks/use-toast"

export function handleNetworkError(error: unknown, customMessage?: string) {
  console.error("[v0] Network error:", error)

  if (error instanceof TypeError && error.message.includes("fetch")) {
    toast({
      title: "No hay conexión con el servidor",
      description: "Por favor verifica tu conexión a internet e intenta nuevamente.",
      variant: "destructive",
    })
    return
  }

  if (
    error instanceof Error &&
    (error.message.includes("NetworkError") ||
      error.message.includes("Failed to fetch") ||
      error.message.includes("Network request failed"))
  ) {
    toast({
      title: "No hay conexión con el servidor",
      description: "Por favor verifica tu conexión a internet e intenta nuevamente.",
      variant: "destructive",
    })
    return
  }

  toast({
    title: "Error",
    description: customMessage || (error instanceof Error ? error.message : "Ha ocurrido un error inesperado"),
    variant: "destructive",
  })
}
