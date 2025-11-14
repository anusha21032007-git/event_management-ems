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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { List, ShieldCheck, XCircle, AlertCircle } from 'lucide-react';

const statusColors = {
  pending_hod: 'bg-yellow-500',
  resubmitted: 'bg-indigo-500', // Added resubmitted color
  returned_to_coordinator: 'bg-red-500',
  pending_dean: 'bg-yellow-600',
  returned_to_hod: 'bg-orange-600', // Highlight returned to HOD
  pending_principal: 'bg-yellow-700',
  returned_to_dean: 'bg-orange-700',
  approved: 'bg-green-500',
  rejected: 'bg-red-700',
  cancelled: 'bg-gray-500',
};

const HodDashboard = () => {
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    
    // RLS ensures only events submitted by the current user's department are returned
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        venues ( name ),
        submitted_by:profiles ( first_name, last_name )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Error fetching events for dashboard.');
      console.error('Error fetching events:', error);
    } else {
      const mappedData = data.map(event => ({
        ...event,
        profiles: event.submitted_by,
      }));
      setAllEvents(mappedData);
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
    return status === 'pending_hod' || status === 'returned_to_hod' || status === 'resubmitted';
  };

  const pendingEvents = allEvents.filter(e => isReviewable(e));
  const otherEvents = allEvents.filter(e => !isReviewable(e));

  const renderEventTable = (eventsList: any[], title: string, showSubmittedBy: boolean) => (
    <Card className="bg-white rounded-lg shadow">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-background border-b">
              <TableHead className="text-primary">Title</TableHead>
              {/* Removed Submitted By column */}
              <TableHead className="text-primary">Venue</TableHead>
              <TableHead className="text-primary">Date</TableHead>
              <TableHead className="text-primary">Status</TableHead>
              <TableHead className="text-primary text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">Loading...</TableCell>
              </TableRow>
            ) : eventsList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center">No events found in this category.</TableCell>
              </TableRow>
            ) : (
              eventsList.map((event: any) => {
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
                    <TableCell className="text-right">
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
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold">HOD Dashboard</h2>
      
      <Tabs defaultValue="pending">
        <TabsList className="mb-4 bg-muted p-1 rounded-lg">
          <TabsTrigger value="pending" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <ShieldCheck className="w-4 h-4 mr-2" />
            Pending My Action ({pendingEvents.length})
          </TabsTrigger>
          <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <List className="w-4 h-4 mr-2" />
            All Department Events ({allEvents.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {/* Note: showSubmittedBy is now false, but the function signature requires it. The column is removed inside renderEventTable */}
          {renderEventTable(pendingEvents, "Events Requiring My Approval", false)} 
        </TabsContent>
        
        <TabsContent value="all">
          {/* Note: showSubmittedBy is now false, but the function signature requires it. The column is removed inside renderEventTable */}
          {renderEventTable(allEvents, "All Events Submitted by Department Coordinators", false)}
        </TabsContent>
      </Tabs>

      {selectedEvent && (
        <EventActionDialog
          event={selectedEvent}
          isOpen={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onActionSuccess={handleActionSuccess}
          role="hod"
        />
      )}
    </div>
  );
};

export default HodDashboard;