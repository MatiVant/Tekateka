'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Plus, Trash2, Edit } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

interface TicketTier {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  quantity: number;
  available_quantity: number;
  tier_order: number;
}

interface TicketTiersManagerProps {
  eventId: string;
}

export function TicketTiersManager({ eventId }: TicketTiersManagerProps) {
  const [tiers, setTiers] = useState<TicketTier[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    base_price: '',
    quantity: '',
  });
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

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
      const { error: insertError } = await supabase
        .from('ticket_tiers')
        .insert({
          event_id: eventId,
          name: formData.name,
          description: formData.description || null,
          base_price: parseFloat(formData.base_price),
          quantity: parseInt(formData.quantity),
          available_quantity: parseInt(formData.quantity),
          tier_order: tiers.length,
        });

      if (insertError) throw insertError;

      setFormData({ name: '', description: '', base_price: '', quantity: '' });
      setShowForm(false);
      fetchTiers();
    } catch (error) {
      console.error('[v0] Error creating tier:', error);
      setError(error instanceof Error ? error.message : 'Error al crear tipo de entrada');
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
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Tipos de Entrada</h3>
        <Button onClick={() => setShowForm(!showForm)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Agregar Tipo
        </Button>
      </div>

      {showForm && (
        <Card className="p-6">
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

            <div className="flex gap-3">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Guardando...
                  </>
                ) : (
                  'Guardar Tipo'
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="space-y-2">
        {tiers.map((tier) => (
          <Card key={tier.id} className="p-4 flex items-center justify-between">
            <div>
              <h4 className="font-semibold">{tier.name}</h4>
              {tier.description && <p className="text-sm text-muted-foreground">{tier.description}</p>}
              <p className="text-sm">
                {formatCurrency(tier.base_price)} - {tier.available_quantity}/{tier.quantity} disponibles
              </p>
            </div>
            <Button
              variant="destructive"
              size="icon"
              onClick={() => handleDelete(tier.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
