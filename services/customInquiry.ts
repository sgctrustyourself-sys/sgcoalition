import { supabase } from './supabase';

export interface CustomInquiryData {
    customerName: string;
    customerEmail: string;
    customerPhone?: string;
    productType: 'apparel-pants' | 'apparel-shirt' | '3d-printed' | 'other';
    title: string;
    description: string;
    referenceImages: string[];
    budgetRange: 'under-100' | '100-250' | '250-500' | '500+' | 'flexible';
    timeline: 'no-rush' | '1-2-weeks' | '2-4-weeks' | 'asap';
}

/**
 * Submit a custom product inquiry
 */
export async function submitCustomInquiry(data: CustomInquiryData): Promise<string> {
    const { data: inquiry, error } = await supabase
        .from('custom_inquiries')
        .insert([{
            customer_name: data.customerName,
            customer_email: data.customerEmail,
            customer_phone: data.customerPhone || null,
            product_type: data.productType,
            title: data.title,
            description: data.description,
            reference_images: data.referenceImages,
            budget_range: data.budgetRange,
            timeline: data.timeline,
            status: 'new'
        }])
        .select()
        .single();

    if (error) {
        console.error('Error submitting inquiry:', error);
        throw new Error('Failed to submit inquiry. Please try again.');
    }

    return inquiry.id;
}

/**
 * Get all custom inquiries (admin only)
 */
export async function getAllInquiries() {
    const { data, error } = await supabase
        .from('custom_inquiries')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching inquiries:', error);
        throw new Error('Failed to fetch inquiries');
    }

    return data;
}

/**
 * Update inquiry status and admin notes
 */
export async function updateInquiry(
    id: string,
    updates: {
        status?: string;
        adminNotes?: string;
        quoteAmount?: number;
    }
) {
    const updateData: any = {};

    if (updates.status) updateData.status = updates.status;
    if (updates.adminNotes !== undefined) updateData.admin_notes = updates.adminNotes;
    if (updates.quoteAmount !== undefined) updateData.quote_amount = updates.quoteAmount;

    const { error } = await supabase
        .from('custom_inquiries')
        .update(updateData)
        .eq('id', id);

    if (error) {
        console.error('Error updating inquiry:', error);
        throw new Error('Failed to update inquiry');
    }
}

/**
 * Delete an inquiry
 */
export async function deleteInquiry(id: string) {
    const { error } = await supabase
        .from('custom_inquiries')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting inquiry:', error);
        throw new Error('Failed to delete inquiry');
    }
}
