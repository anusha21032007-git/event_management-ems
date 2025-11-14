import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
import EventDialog from '@/components/EventDialog';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { List, ShieldCheck, XCircle, AlertCircle, PlusCircle, MoreHorizontal, Download } from 'lucide-react';
import ReturnReasonDialog from '@/components/ReturnReasonDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import EventReportDialog from '@/components/EventReportDialog'; // Updated Import

const statusColors = {
  pending_hod: 'bg-yellow-500',
  resubmitted: 'bg-indigo-500', // Resubmitted status
  returned_to_coordinator: 'bg-red-500', // Returned to Coordinator (requires action)
  pending_dean: 'bg-yellow-600',
  returned_to_hod: 'bg-orange-600', // Returned to HOD (no action required by coordinator)
  pending_principal: 'bg-yellow-700',
  returned_to_dean: 'bg-orange-700',
  approved: 'bg-green-500',
  rejected: 'bg-red-700',
  cancelled: 'bg-gray-500',
};

const CoordinatorDashboard = () => {
  const { user } = useAuth();
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [isReturnReasonDialogOpen, setIsReturnReasonDialogOpen] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false); // Renamed state

  const fetchEvents = async () => {
    if (!user) return;
    setLoading(true);
    
    // RLS ensures only events submitted by the current user are returned
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        venues ( name ),
        submitted_by:profiles ( first_name, last_name )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Error fetching events.');
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
  }, [user]);

  const handleSuccess = () => {
    fetchEvents();
    setSelectedEvent(null);
  };

  const handleViewAction = (event: any) => {
    const isReturned = event.status === 'returned_to_coordinator';
    setSelectedEvent({ 
      ...event, 
      mode: isReturned ? 'edit' : 'view' 
    });
  };
  
  const handleDownloadReport = (event: any) => {
    setSelectedEvent(event);
    setIsReportDialogOpen(true); // Use the standard report dialog
  };

  // Events requiring coordinator action (returned_to_coordinator) or pending initial approval flow
  const pendingEvents = allEvents.filter(e => 
    e.status.startsWith('pending') || 
    e.status === 'resubmitted' || // Include resubmitted events here
    e.status === 'returned_to_hod' || 
    e.status === 'returned_to_dean' 
  );
  
  // Events requiring coordinator correction (returned_to_coordinator) or final rejection
  const returnedEvents = allEvents.filter(e => e.status === 'returned_to_coordinator' || e.status === 'rejected');
  
  // Approved events
  const approvedEvents = allEvents.filter(e => e.status === 'approved');

  const renderEventTable = (eventsList: any[], title: string) => (
    <Card className="bg-white rounded-lg shadow">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-background border-b">
              <TableHead className="text-primary">Title</TableHead>
              <TableHead className="text-primary">Dept/Club/Society</TableHead>
              <TableHead className="text-primary">Venue</TableHead>
              <TableHead className="text-primary">Date</TableHead>
              <TableHead className="text-primary">Status</TableHead>
              <TableHead className="text-primary text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">Loading...</TableCell>
              </TableRow>
            ) : eventsList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">No events found in this category.</TableCell>
              </TableRow>
            ) : (
              eventsList.map((event: any) => {
                const isReturnedToCoordinator = event.status === 'returned_to_coordinator';
                const isApproved = event.status === 'approved';
                return (
                  <TableRow key={event.id} className="bg-accent hover:bg-accent/80 transition-colors">
                    <TableCell className="font-medium text-blue-600">{event.title}</TableCell>
                    <TableCell>{event.department_club || 'N/A'}</TableCell>
                    <TableCell>{event.venues?.name || event.other_venue_details || 'N/A'}</TableCell>
                    <TableCell>{format(new Date(event.event_date), 'PPP')}</TableCell>
                    <TableCell>
                      <Badge className={`${statusColors[event.status as keyof typeof statusColors]} text-white capitalize`}>
                        {event.status.replace(/_/g, ' ').replace('dean', 'Dean IR')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewAction(event)}>
                            {isReturnedToCoordinator ? 'Edit & Resubmit' : 'View Details'}
                          </DropdownMenuItem>
                          
                          {(isReturnedToCoordinator || event.remarks) && (
                            <DropdownMenuItem 
                              onClick={() => {
                                setSelectedEvent(event);
                                setIsReturnReasonDialogOpen(true);
                              }}
                            >
                              View Remarks History
                            </DropdownMenuItem>
                          )}
                          
                          {isApproved && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleDownloadReport(event)}
                                className="text-primary font-medium"
                              >
                                <Download className="h-4 w-4 mr-2" /> Download Report
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
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
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Coordinator Dashboard</h2>
        <Button onClick={() => setSelectedEvent({ mode: 'create' })}>
          <PlusCircle className="mr-2 h-4 w-4" /> Create New Event
        </Button>
      </div>
      
      <Tabs defaultValue="pending">
        <TabsList className="mb-4 bg-muted p-1 rounded-lg">
          <TabsTrigger value="pending" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <ShieldCheck className="w-4 h-4 mr-2" />
            Pending Approval ({pendingEvents.length})
          </TabsTrigger>
          <TabsTrigger value="returned" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <AlertCircle className="w-4 h-4 mr-2" />
            Returned/Rejected ({returnedEvents.length})
          </TabsTrigger>
          <TabsTrigger value="approved" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <List className="w-4 h-4 mr-2" />
            Approved Events ({approvedEvents.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {renderEventTable(pendingEvents, "Events Awaiting Approval")}
        </TabsContent>
        
        <TabsContent value="returned">
          {renderEventTable(returnedEvents, "Events Returned for Correction or Rejected")}
        </TabsContent>
        
        <TabsContent value="approved">
          {renderEventTable(approvedEvents, "Approved Events")}
        </TabsContent>
      </Tabs>

      {selectedEvent && selectedEvent.mode && (
        <EventDialog
          event={selectedEvent.id ? selectedEvent : null}
          isOpen={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onSuccess={handleSuccess}
          mode={selectedEvent.mode as 'create' | 'edit' | 'view'}
        />
      )}
      
      {selectedEvent && isReturnReasonDialogOpen && (
        <ReturnReasonDialog
          isOpen={isReturnReasonDialogOpen}
          onClose={() => setIsReturnReasonDialogOpen(false)}
          event={selectedEvent}
        />
      )}
      
      {selectedEvent && isReportDialogOpen && (
        <EventReportDialog
          event={selectedEvent}
          isOpen={isReportDialogOpen}
          onClose={() => {
            setIsReportDialogOpen(false);
            setSelectedEvent(null);
          }}
        />
      )}
    </div>
  );
};

export default CoordinatorDashboard;