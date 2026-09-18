'use server';

import { createClient as createServerClient } from '@/lib/supabase/server';

interface ValidationResult {
  isValid: boolean;
  discountAmount: number;
  finalPrice: number;
  error?: string;
}

export async function validatePromotion(
  eventId: string,
  promotionCode: string,
  basePrice: number
): Promise<ValidationResult> {
  const supabase = await createServerClient();
  
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const { data: promoData, error: fetchError } = await supabase
      .from('promotion_codes')
      .select('*')
      .eq('event_id', eventId)
      .eq('code', promotionCode.trim().toUpperCase())
      .eq('is_active', true)
      .maybeSingle();

    const validFrom = !promoData?.valid_from || promoData.valid_from <= today;
    const validUntil = !promoData?.valid_until || promoData.valid_until >= today;

    if (fetchError || !promoData || !validFrom || !validUntil) {
      return {
        isValid: false,
        discountAmount: 0,
        finalPrice: basePrice,
        error: 'Código de promoción inválido o expirado',
      };
    }

    // Verificar límite de usos
    if (promoData.max_uses && promoData.current_uses >= promoData.max_uses) {
      return {
        isValid: false,
        discountAmount: 0,
        finalPrice: basePrice,
        error: 'Este código de promoción ya alcanzó el límite de usos',
      };
    }

    let discountAmount = 0;
    let finalPrice = basePrice;

    if (promoData.promotion_type === 'protocol') {
      discountAmount = basePrice;
      finalPrice = 0;
    } else if (promoData.promotion_type === 'percentage') {
      discountAmount = (basePrice * promoData.discount_value) / 100;
      finalPrice = basePrice - discountAmount;
    } else if (promoData.promotion_type === 'fixed') {
      discountAmount = promoData.discount_value;
      finalPrice = Math.max(0, basePrice - discountAmount);
    } else if (promoData.promotion_type === '2x1') {
      discountAmount = basePrice / 2;
      finalPrice = basePrice / 2;
    }

    return {
      isValid: true,
      discountAmount,
      finalPrice: Math.max(0, finalPrice),
    };
  } catch (error) {
    console.error('[v0] Error validating promotion:', error);
    return {
      isValid: false,
      discountAmount: 0,
      finalPrice: basePrice,
      error: 'Error al validar el código de promoción',
    };
  }
}

export async function recordPromotionUsage(
  ticketId: string,
  promotionCodeId: string,
  originalPrice: number,
  discountAmount: number,
  finalPrice: number
) {
  const supabase = await createServerClient();

  try {
    // Guardar uso de promoción
    const { error: insertError } = await supabase
      .from('ticket_promotions')
      .insert({
        ticket_id: ticketId,
        promotion_code_id: promotionCodeId,
        original_price: originalPrice,
        discount_amount: discountAmount,
        final_price: finalPrice,
      });

    if (insertError) throw insertError;

    // Incrementar contador de usos en el código de promoción
    const { error: updateError } = await supabase.rpc('increment_promotion_usage', { id: promotionCodeId });
    if (updateError) throw updateError;
  } catch (error) {
    console.error('[v0] Error recording promotion usage:', error);
    throw error;
  }
}
