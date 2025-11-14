import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Badge } from './ui/badge';
import { Image, MessageSquare } from 'lucide-react';
import PosterDialog from './PosterDialog';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Terminal } from 'lucide-react';

const formSchema = z.object({
  remarks: z.string().optional(),
});

type EventActionDialogProps = {
  event: any;
  isOpen: boolean;
  onClose: () => void;
  onActionSuccess: () => void;
  role: 'hod' | 'dean' | 'principal';
};

const roleActions = {
  hod: {
    approve: { label: 'Approve & Forward to Dean IR', status: 'pending_dean', timestampField: 'hod_approval_at' },
    // HOD returns directly to Coordinator
    return: { label: 'Return to Coordinator', status: 'returned_to_coordinator' },
  },
  dean: {
    approve: { label: 'Approve & Forward to Principal', status: 'pending_principal', timestampField: 'dean_approval_at' },
    // Dean returns to HOD
    return: { label: 'Return to HOD', status: 'returned_to_hod' },
  },
  principal: {
    approve: { label: 'Approve Event', status: 'approved', timestampField: 'principal_approval_at' },
    reject: { label: 'Reject', status: 'rejected' },
    // Principal returns directly to Coordinator
    return: { label: 'Return to Coordinator', status: 'returned_to_coordinator' },
  },
};

const formatTime12Hour = (time24: string | null | undefined): string => {
  if (!time24) return 'N/A';
  try {
    const [h, m] = time24.split(':');
    const hour = parseInt(h, 10);
    const minute = parseInt(m, 10);

    const period = hour >= 12 ? 'PM' : 'AM';
    let hour12 = hour % 12;
    if (hour12 === 0) {
      hour12 = 12;
    }

    return `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;
  } catch (error) {
    return time24; // Fallback to original string if format is unexpected
  }
};

const EventActionDialog = ({ event, isOpen, onClose, onActionSuccess, role }: EventActionDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPosterDialogOpen, setIsPosterDialogOpen] = useState(false);
  const actions = roleActions[role];
  
  const isResubmitted = event.status === 'resubmitted';

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { remarks: '' }, // Clear default remarks to ensure new input
  });

  const handleAction = async (actionType: 'approve' | 'reject' | 'return') => {
    const action = actions[actionType as keyof typeof actions];
    const remarks = form.getValues('remarks');
    
    if ((actionType === 'reject' || actionType === 'return') && !remarks?.trim()) {
      form.setError('remarks', { type: 'manual', message: 'Remarks are required to reject or return an event.' });
      return;
    }

    setIsSubmitting(true);
    
    const { error } = await supabase.rpc('update_event_status', {
      p_event_id: event.id,
      p_new_status: action.status,
      p_new_remarks: remarks || null,
      p_approval_timestamp_field: action.timestampField || null,
    });

    if (error) {
      toast.error(`Failed to update event: ${error.message}`);
    } else {
      toast.success('Event status updated successfully.');
      onActionSuccess();
    }
    setIsSubmitting(false);
  };

  const formatArray = (arr: string[] | null | undefined) => {
    if (!arr || arr.length === 0) return 'N/A';
    return arr.map(item => item.charAt(0).toUpperCase() + item.slice(1).replace(/_/g, ' ')).join(', ');
  };

  const renderCoordinators = () => {
    const names = event.coordinator_name || [];
    const contacts = event.coordinator_contact || [];
    
    if (names.length === 0) return <span>N/A</span>;

    return (
      <ul className="list-disc list-inside space-y-1">
        {names.map((name: string, index: number) => (
          <li key={index}>
            {name} ({contacts[index] || 'No contact'})
          </li>
        ))}
      </ul>
    );
  };
  
  const renderSpeakers = () => {
    const names = event.speakers || [];
    const details = event.speaker_details || [];
    
    if (names.length === 0) return <span>N/A</span>;

    return (
      <ul className="list-disc list-inside space-y-1">
        {names.map((name: string, index: number) => (
          <li key={index}>
            <strong>{name}</strong>: {details[index] || 'No details provided'}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Review Event: {event.title}</DialogTitle>
            <DialogDescription>
              Submitted by: {event.profiles?.first_name} {event.profiles?.last_name}
            </DialogDescription>
          </DialogHeader>
          
          {isResubmitted && event.coordinator_resubmission_reason && (
            <Alert variant="default" className="bg-indigo-100 border-indigo-400 text-indigo-800">
              <Terminal className="h-4 w-4" />
              <AlertTitle>Coordinator Resubmission Reason</AlertTitle>
              <AlertDescription>
                {event.coordinator_resubmission_reason}
              </AlertDescription>
            </Alert>
          )}

          {event.poster_url && (
            <div className="flex justify-end">
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={() => setIsPosterDialogOpen(true)}
              >
                <Image className="h-4 w-4 mr-2" /> View Poster
              </Button>
            </div>
          )}

          <div className="space-y-4 py-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div><strong>Department/Club:</strong> {event.department_club || 'N/A'}</div>
              <div><strong>Mode:</strong> <Badge variant="secondary" className="capitalize">{event.mode_of_event || 'N/A'}</Badge></div>
              <div className="col-span-2">
                <strong>Coordinators:</strong>
                {renderCoordinators()}
              </div>
              <div><strong>Date:</strong> {format(new Date(event.event_date), 'PPP')}</div>
              <div><strong>Time:</strong> {formatTime12Hour(event.start_time)} - {formatTime12Hour(event.end_time)}</div>
              <div><strong>Venue:</strong> {event.venues?.name || event.other_venue_details || 'N/A'}</div>
              <div><strong>Expected Participants:</strong> {event.expected_audience || 'N/A'}</div>
            </div>

            <div className="border-t pt-4 mt-4">
              <h4 className="font-semibold mb-2">Program Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div><strong>Academic Year:</strong> {event.academic_year || 'N/A'}</div>
                <div><strong>Program Driven By:</strong> {event.program_driven_by || 'N/A'}</div>
                <div><strong>Quarter:</strong> {event.quarter || 'N/A'}</div>
                <div><strong>Program Theme:</strong> {event.program_theme || 'N/A'}</div>
                <div className="col-span-2"><strong>Program Type:</strong> {event.program_type || 'N/A'}</div>
              </div>
            </div>

            <div className="border-t pt-4 mt-4">
              <h4 className="font-semibold mb-2">Event Objectives</h4>
              <div><strong>Description:</strong> {event.description || 'N/A'}</div>
              <div><strong>Objective:</strong> {event.objective || 'N/A'}</div>
              <div><strong>Proposed Outcomes:</strong> {event.proposed_outcomes || 'N/A'}</div>
              <div><strong>Category:</strong> {formatArray(event.category)}</div>
              <div><strong>Target Audience:</strong> {formatArray(event.target_audience)}</div>
              <div><strong>SDG Alignment:</strong> {formatArray(event.sdg_alignment)}</div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 border-t pt-4 mt-4">
              <div className="col-span-2">
                <strong>Speakers/Resource Persons:</strong>
                {renderSpeakers()}
              </div>
              <div><strong>Budget Estimate:</strong> ₹{event.budget_estimate?.toFixed(2) || '0.00'}</div>
              <div><strong>Funding Source:</strong> {event.budget_estimate > 0 ? formatArray(event.funding_source) : 'N/A (No budget)'}</div>
              <div className="col-span-2"><strong>Promotion Strategy:</strong> {formatArray(event.promotion_strategy)}</div>
            </div>

            <div className="border-t pt-4 space-y-2 mt-4">
              <div><strong>HOD Approval Date:</strong> {event.hod_approval_at ? format(new Date(event.hod_approval_at), 'PPP p') : 'Pending'}</div>
              <div><strong>Dean IR Approval Date:</strong> {event.dean_approval_at ? format(new Date(event.dean_approval_at), 'PPP p') : 'Pending'}</div>
              <div><strong>Principal Approval Date:</strong> {event.principal_approval_at ? format(new Date(event.principal_approval_at), 'PPP p') : 'Pending'}</div>
            </div>
          </div>
          
          {/* NEW: Display previous remarks as view-only */}
          {event.remarks && (
            <div className="border-t pt-4 mt-4">
              <h4 className="font-semibold mb-2 flex items-center">
                <MessageSquare className="h-4 w-4 mr-2" /> Last Approver Remarks (View Only)
              </h4>
              <Textarea value={event.remarks} disabled className="bg-gray-50" />
            </div>
          )}

          <Form {...form}>
            <form className="space-y-4">
              <FormField
                control={form.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    {/* Renamed label for clarity */}
                    <FormLabel>New Remarks for Action</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Add remarks (required for rejection/return)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>

          <DialogFooter className="flex-col sm:flex-row sm:justify-between items-center gap-2">
            <div className="flex gap-2">
              {role === 'principal' && (
                <Button
                  variant="destructive"
                  onClick={() => handleAction('reject')}
                  disabled={isSubmitting}
                >
                  {actions.reject.label}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => handleAction('return')}
                disabled={isSubmitting}
              >
                {actions.return.label}
              </Button>
            </div>
            <Button
              onClick={() => handleAction('approve')}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? 'Submitting...' : actions.approve.label}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {event && (
        <PosterDialog
          isOpen={isPosterDialogOpen}
          onClose={() => setIsPosterDialogOpen(false)}
          posterUrl={event.poster_url}
          eventTitle={event.title}
        />
      )}
    </>
  );
};

export default EventActionDialog;