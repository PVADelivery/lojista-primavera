import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Utensils, Layers, Package, ListPlus, Loader2, Sparkles } from "lucide-react";

interface IFoodImportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  previewData: {
    merchant_name?: string;
    categories_count: number;
    products_found: number;
    products_created: number;
    products_updated: number;
    options_count: number;
    sample_categories?: string[];
  } | null;
  isLoading: boolean;
  isExecuting: boolean;
}

export function IFoodImportPreviewModal({
  isOpen,
  onClose,
  onConfirm,
  previewData,
  isLoading,
  isExecuting,
}: IFoodImportPreviewModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isExecuting && !open && onClose()}>
      <DialogContent className="max-w-xl rounded-[2.5rem] bg-card border border-border p-6 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
              <Utensils className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black tracking-tight">
                Importação de Cardápio iFood
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Revise os itens encontrados antes de publicar no MT 24 Horas
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-rose-500" />
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest animate-pulse">
              Consultando Catálogo no iFood...
            </p>
          </div>
        ) : previewData ? (
          <div className="space-y-5 py-2">
            {previewData.merchant_name && (
              <div className="flex items-center justify-between rounded-2xl bg-muted/40 p-3.5 border border-border/60">
                <span className="text-xs font-medium text-muted-foreground">Loja Conectada:</span>
                <span className="text-xs font-black text-foreground">{previewData.merchant_name}</span>
              </div>
            )}

            {/* Grid de Resumo */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-secondary/40 border border-border/50">
                <Layers className="h-5 w-5 text-amber-500 mb-1" />
                <span className="text-xl font-black text-foreground">{previewData.categories_count}</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Categorias</span>
              </div>

              <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-secondary/40 border border-border/50">
                <Package className="h-5 w-5 text-blue-500 mb-1" />
                <span className="text-xl font-black text-foreground">{previewData.products_found}</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Itens Totais</span>
              </div>

              <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                <Sparkles className="h-5 w-5 text-emerald-500 mb-1" />
                <span className="text-xl font-black text-emerald-500">+{previewData.products_created}</span>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Novos Itens</span>
              </div>

              <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                <ListPlus className="h-5 w-5 text-indigo-500 mb-1" />
                <span className="text-xl font-black text-indigo-500">{previewData.options_count}</span>
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">Grupos Opções</span>
              </div>
            </div>

            {/* Avisos Importantes */}
            <div className="rounded-2xl bg-muted/30 p-4 border border-border/60 space-y-2">
              <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Prevenção de duplicidade:</strong> Os produtos já importados anteriormente serão atualizados sem duplicar.
                </span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>
                  <strong>Complementos inclusos:</strong> Grupos de adicionais, limites e preços extras serão vinculados aos produtos.
                </span>
              </div>
            </div>

            {previewData.sample_categories && previewData.sample_categories.length > 0 && (
              <div>
                <span className="text-[11px] font-bold text-muted-foreground uppercase block mb-1.5">
                  Algumas categorias detectadas:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {previewData.sample_categories.map((cat, idx) => (
                    <span key={idx} className="px-2.5 py-1 rounded-lg bg-secondary text-[11px] font-semibold text-secondary-foreground border border-border/40">
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Não foi possível carregar a prévia do catálogo.
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 mt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isExecuting}
            className="rounded-xl font-bold"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isLoading || !previewData || isExecuting}
            className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black px-6 shadow-lg shadow-rose-500/20"
          >
            {isExecuting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Importando Cardápio...
              </>
            ) : (
              "Confirmar Importação"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
