declare module "qrcode" {
  const QRCode: {
    toCanvas: (canvas: HTMLCanvasElement, text: string, options?: QRCodeOptions) => Promise<void>
    toDataURL: (text: string, options?: QRCodeOptions) => Promise<string>
    toString: (text: string, options?: QRCodeOptions) => Promise<string>
  }

  interface QRCodeOptions {
    errorCorrectionLevel?: "L" | "M" | "Q" | "H"
    type?: string
    quality?: number
    margin?: number
    color?: { dark?: string; light?: string }
    width?: number
  }

  export default QRCode
}
