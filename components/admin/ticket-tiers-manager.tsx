'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

interface TicketTier {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  quantity: number;
  available_quantity: number;
  tier_order: number;
  promotion_type: "standard" | "2x1";
}

interface TicketTiersManagerProps {
  eventId: string;
}

export function TicketTiersManager({ eventId }: TicketTiersManagerProps) {
  const [tiers, setTiers] = useState<TicketTier[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    base_price: '',
    quantity: '',
    promotion_type: 'standard' as 'standard' | '2x1',
  });
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const resetForm = () => {
    setFormData({ name: '', description: '', base_price: '', quantity: '', promotion_type: 'standard' });
    setEditingTierId(null);
    setShowForm(false);
  };

  const startEditing = (tier: TicketTier) => {
    setEditingTierId(tier.id);
    setFormData({
      name: tier.name,
      description: tier.description || '',
      base_price: String(tier.base_price),
      quantity: String(tier.quantity),
      promotion_type: tier.promotion_type,
    });
    setShowForm(true);
    setError(null);
  };

  async function fetchTiers() {
    try {
      const { data, error: fetchError } = await supabase
        .from('ticket_tiers')
        .select('*')
        .eq('event_id', eventId)
        .order('tier_order', { ascending: true });

      if (fetchError) throw fetchError;
      setTiers(data || []);
    } catch (error) {
      console.error('[v0] Error fetching tiers:', error);
      setError('Error al cargar los tipos de entrada');
    }
  };

  useEffect(() => {
    window.setTimeout(() => { void fetchTiers() }, 0)
  }, [eventId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const quantity = parseInt(formData.quantity);
      const basePrice = parseFloat(formData.base_price);
      let saveError;

      if (editingTierId) {
        const currentTier = tiers.find((tier) => tier.id === editingTierId);
        const soldQuantity = currentTier ? currentTier.quantity - currentTier.available_quantity : 0;
        if (quantity < soldQuantity) {
          throw new Error(`La cantidad no puede ser menor que las ${soldQuantity} entradas ya vendidas`);
        }

        const result = await supabase
          .from('ticket_tiers')
          .update({
            name: formData.name,
            description: formData.description || null,
            base_price: basePrice,
            quantity,
            available_quantity: quantity - soldQuantity,
            promotion_type: formData.promotion_type,
          })
          .eq('id', editingTierId);
        saveError = result.error;
      } else {
        const result = await supabase
          .from('ticket_tiers')
          .insert({
            event_id: eventId,
            name: formData.name,
            description: formData.description || null,
            base_price: basePrice,
            quantity,
            available_quantity: quantity,
            tier_order: tiers.length,
            promotion_type: formData.promotion_type,
          });
        saveError = result.error;
      }

      if (saveError) throw saveError;

      resetForm();
      void fetchTiers();
    } catch (error) {
      console.error('[v0] Error saving tier:', error);
      setError(error instanceof Error ? error.message : 'Error al guardar tipo de entrada');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (tierId: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este tipo de entrada?')) return;

    try {
      const { error: deleteError } = await supabase
        .from('ticket_tiers')
        .delete()
        .eq('id', tierId);

      if (deleteError) throw deleteError;
      fetchTiers();
    } catch (error) {
      console.error('[v0] Error deleting tier:', error);
      setError('Error al eliminar tipo de entrada');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Tipos de entrada</h3>
          <p className="text-sm text-muted-foreground">Definí precio, cupo y modalidad de cada entrada.</p>
        </div>
        <Button
          onClick={() => {
            if (showForm) {
              resetForm();
            } else {
              setError(null);
              setShowForm(true);
            }
          }}
          size="sm"
          className="w-fit"
        >
          <Plus className="h-4 w-4 mr-2" />
          Agregar Tipo
        </Button>
      </div>

      {showForm && (
        <Card className="rounded-xl border-dashed bg-muted/20 p-4 sm:p-6">
          <div className="mb-4">
            <h4 className="font-semibold">{editingTierId ? 'Editar tipo de entrada' : 'Nuevo tipo de entrada'}</h4>
            {editingTierId && <p className="text-sm text-muted-foreground">Las entradas ya vendidas se conservan y no se modifican.</p>}
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tier-name">Nombre del Tipo *</Label>
              <Input
                id="tier-name"
                placeholder="Early Bird, General, VIP, etc."
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tier-description">Descripción</Label>
              <Input
                id="tier-description"
                placeholder="Descripción del tipo de entrada"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tier-promotion-type">Modalidad</Label>
              <select
                id="tier-promotion-type"
                value={formData.promotion_type}
                onChange={(e) => setFormData({ ...formData, promotion_type: e.target.value as 'standard' | '2x1' })}
                className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="standard">Entrada individual</option>
                <option value="2x1">2x1 (crea 2 entradas)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tier-price">Precio Base ($) *</Label>
                <Input
                  id="tier-price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="50.00"
                  value={formData.base_price}
                  onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tier-quantity">Cantidad *</Label>
                <Input
                  id="tier-quantity"
                  type="number"
                  min="1"
                  placeholder="100"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" className="w-fit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Guardando...
                  </>
                ) : (
                  editingTierId ? 'Guardar cambios' : 'Guardar Tipo'
                )}
              </Button>
              <Button type="button" variant="outline" className="w-fit" onClick={resetForm}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-2">
        {tiers.map((tier) => (
          <Card key={tier.id} className="flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h4 className="font-semibold">{tier.name}</h4>
              {tier.description && <p className="text-sm text-muted-foreground">{tier.description}</p>}
              <p className="text-sm">
                {formatCurrency(tier.base_price)} - {tier.available_quantity}/{tier.quantity} disponibles
              </p>
            </div>
            <div className="flex self-end gap-2 sm:self-center">
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={`Editar ${tier.name}`}
                onClick={() => startEditing(tier)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="destructive"
                size="icon-sm"
                aria-label={`Eliminar ${tier.name}`}
                onClick={() => handleDelete(tier.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
