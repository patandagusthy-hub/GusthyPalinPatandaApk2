import React, { ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
    this.handleReload = this.handleReload.bind(this);
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  public handleReload(): void {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="bg-slate-900 border border-rose-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-4 max-w-2xl mx-auto my-6">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>

          <div className="space-y-1">
            <h3 className="text-lg sm:text-xl font-black text-white">
              {this.props.fallbackTitle ? `Kendala pada ${this.props.fallbackTitle}` : "Terjadi Kendala Memuat Komponen"}
            </h3>
            <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
              Sistem mendeteksi galat saat merender antarmuka ini. Data ujian Anda tetap aman dan tersimpan.
            </p>
          </div>

          {this.state.error && (
            <div className="text-left bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-[11px] font-mono text-rose-300/90 overflow-x-auto max-h-32">
              <span className="font-bold text-rose-400">Pesan: </span>
              {this.state.error.message || "Unknown runtime error"}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={this.handleReload}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center space-x-2 shadow-lg shadow-purple-600/25 transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Muat Ulang Tampilan</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
