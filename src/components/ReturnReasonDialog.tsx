import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { ScrollArea } from './ui/scroll-area';
import { MessageSquare } from 'lucide-react';

type EventHistory = {
  id: string; // Changed from number to string/uuid
  event_id: string;
  old_status: string | null;
  new_status: string;
  remarks: string | null;
  created_at: string;
  profiles: {
    role: string;
    first_name: string;
    last_name: string;
  } | null;
};

type ReturnReasonDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  event: any;
};

const roleDisplayMap: Record<string, string> = {
  hod: 'HOD',
  dean: 'Dean IR',
  principal: 'Principal',
  coordinator: 'Coordinator',
  admin: 'Admin',
};

const ReturnReasonDialog = ({ isOpen, onClose, event }: ReturnReasonDialogProps) => {
  const [history, setHistory] = useState<EventHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!event?.id) return;

    const fetchHistory = async () => {
      setLoading(true);
      // Fetch history records for the event, ordered by creation time
      const { data, error } = await supabase
        .from('event_history')
        .select(`
          id,
          event_id,
          old_status,
          new_status,
          remarks,
          created_at,
          profiles ( role, first_name, last_name )
        `)
        .eq('event_id', event.id)
        .order('created_at', { ascending: false });

      if (error) {
        toast.error('Failed to fetch event history.');
        console.error('Error fetching history:', error);
      } else {
        setHistory(data as EventHistory[] || []);
      }
      setLoading(false);
    };

    fetchHistory();
  }, [event.id]);

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace('dean', 'Dean IR').toUpperCase();
  };
  
  const getActorName = (record: EventHistory) => {
    if (record.profiles) {
      return `${record.profiles.first_name} ${record.profiles.last_name}`;
    }
    // Fallback for system actions where profiles might be null
    return 'System/Unknown';
  };
  
  const getActorRole = (record: EventHistory) => {
    const role = record.profiles?.role || 'admin'; // Default to admin if profile is missing (e.g., system trigger)
    return roleDisplayMap[role] || role;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Remarks History for: {event.title}</DialogTitle>
          <DialogDescription>
            Review the approval status changes and remarks provided by approvers.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="h-[400px] pr-4">
          {loading ? (
            <div className="text-center py-8">Loading history...</div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No history records found.</div>
          ) : (
            <div className="space-y-4">
              {history.map((record) => (
                <div key={record.id} className="border-l-4 border-primary/50 pl-4 py-2 bg-accent/50 rounded-r-md">
                  <div className="flex justify-between items-start">
                    <p className="font-semibold text-sm">
                      {getActorRole(record)} ({getActorName(record)})
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(record.created_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                  <p className="text-sm mt-1">
                    <span className="font-medium">Status Change:</span> {formatStatus(record.old_status || 'N/A')} &rarr; {formatStatus(record.new_status)}
                  </p>
                  {record.remarks && (
                    <div className="mt-2 p-2 bg-background border rounded-md">
                      <MessageSquare className="h-3 w-3 inline mr-1 text-primary" />
                      <span className="text-sm italic">{record.remarks}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReturnReasonDialog;