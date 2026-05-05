interface SignalKeyable {
  kind: string
  file?: string
  name?: string
  lineStart?: number
  route?: { method?: string; path?: string; handler?: string }
}

export function signalKey(signal: SignalKeyable): string {
  if (signal.kind === 'route' && signal.route?.method && signal.route?.path) {
    return [signal.kind, signal.file ?? "", signal.route.method, signal.route.path].join("|")
  }

  return [signal.kind, signal.file ?? "", signal.name ?? "", signal.lineStart ?? ""].join("|")
}