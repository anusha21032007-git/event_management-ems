import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import EventActionDialog from '@/components/EventActionDialog';
import { toast } from 'sonner';

const statusColors = {
  pending_hod: 'bg-yellow-500',
  resubmitted: 'bg-indigo-500',
  returned_to_coordinator: 'bg-red-500',
  pending_dean: 'bg-yellow-600',
  returned_to_hod: 'bg-orange-600',
  pending_principal: 'bg-yellow-700',
  returned_to_dean: 'bg-orange-700',
  approved: 'bg-green-500',
  rejected: 'bg-red-700',
  cancelled: 'bg-gray-500',
};

const DeanIrDashboard = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    // Fetch only events that are pending Dean action.
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        venues ( name ),
        submitted_by:profiles ( first_name, last_name )
      `)
      .in('status', ['pending_dean', 'returned_to_dean'])
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Error fetching events for dashboard.');
      console.error('Error fetching events:', error);
    } else {
      const mappedData = data.map(event => ({
        ...event,
        profiles: event.submitted_by,
      }));
      setEvents(mappedData);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleActionSuccess = () => {
    fetchEvents();
    setSelectedEvent(null);
  };
  
  const isReviewable = (event: any) => {
    const status = event.status;
    return status === 'pending_dean' || status === 'returned_to_dean';
  };

  return (
    <div>
      <h2 className="text-3xl font-bold mb-6">Events Requiring Attention</h2>
      
      <div className="bg-white rounded-lg shadow">
        <Table>
          <TableHeader>
            <TableRow className="bg-background border-b">
              <TableHead className="text-primary">Title</TableHead>
              <TableHead className="text-primary">Venue</TableHead>
              <TableHead className="text-primary">Date</TableHead>
              <TableHead className="text-primary">Status</TableHead>
              <TableHead className="text-primary">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">Loading...</TableCell>
              </TableRow>
            ) : events.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">No events are currently pending your approval.</TableCell>
              </TableRow>
            ) : (
              events.map((event: any) => {
                const isPending = isReviewable(event);
                return (
                  <TableRow key={event.id} className="bg-accent hover:bg-accent/80 transition-colors">
                    <TableCell className="font-medium text-blue-600">{event.title}</TableCell>
                    <TableCell className={isPending ? "font-semibold text-blue-600" : ""}>
                      {event.venues?.name || event.other_venue_details || 'N/A'}
                    </TableCell>
                    <TableCell>{format(new Date(event.event_date), 'PPP')}</TableCell>
                    <TableCell>
                      <Badge className={`${statusColors[event.status as keyof typeof statusColors]} text-white capitalize`}>
                        {event.status.replace(/_/g, ' ').replace('dean', 'Dean IR')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant={isReviewable(event) ? 'outline' : 'ghost'} 
                        size="sm" 
                        onClick={() => setSelectedEvent(event)}
                      >
                        {isReviewable(event) ? 'Review' : 'View'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {selectedEvent && (
        <EventActionDialog
          event={selectedEvent}
          isOpen={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onActionSuccess={handleActionSuccess}
          role="dean"
        />
      )}
    </div>
  );
};

export default DeanIrDashboard;