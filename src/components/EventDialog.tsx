import { useEffect, useState, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, Plus, Trash2, MessageSquare, UploadCloud, Image } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import TimePicker from './TimePicker';
import ReturnReasonDialog from './ReturnReasonDialog';
import { useDropzone } from 'react-dropzone';
import PosterDialog from './PosterDialog'; // New Import

// --- Helper Functions ---

// Helper function to count characters
const countCharacters = (text: string | null | undefined) => {
  if (!text) return 0;
  return text.length;
};

// Helper function to calculate the current academic year (Sep 1 - Aug 31)
const getAcademicYear = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0 = Jan, 8 = Sep

  // If current month is Sep (8) or later (up to Dec 11)
  if (month >= 8) {
    return `${year}-${year + 1}`;
  }
  // If current month is Jan (0) to Aug (7)
  else {
    return `${year - 1}-${year}`;
  }
};

// Helper function to generate a range of academic years
const getAcademicYearOptions = () => {
  const currentAcademicYear = getAcademicYear();
  const [currentStartYear] = currentAcademicYear.split('-').map(Number);
  
  // Generate 3 years back and 3 years forward from the current academic year start year
  const startRange = currentStartYear - 3; 
  const endRange = currentStartYear + 3; 
  
  const years: string[] = [];
  for (let y = startRange; y <= endRange; y++) {
    years.push(`${y}-${y + 1}`);
  }
  return years.reverse(); // Show most recent first
};

// --- Constants for Dropdowns & Checkboxes ---

const PROGRAM_DRIVEN_BY = ['Institute Council', 'Student Council'];
const QUARTERS = ['Quarter I', 'Quarter II', 'Quarter III', 'Quarter IV'];
const PROGRAM_TYPES = [
  'Level 1 - Expert Talk', 'Level 1 - Exposure Visit', 'Level 1 - Mentoring Session', 'Level 1- Exhibition',
  'Level 2 - Competition', 'Level 2 - Conference', 'Level 2 - Exposure Visit', 'Level 2 - Seminar', 'Level 2 - Workshop',
  'Level 3 - Bootcamp', 'Level 3 - Competition/Hacakthon', 'Level 3 - Demo Day', 'Level 3 - Exhibition', 'Level 3 - Workshop', 'Level 3 - Exposure Visit',
  'Level 4 - Challenges', 'Level 4 - Competition/Hackathon', 'Level 4 - Tech Fest', 'Level 4 - Bootcamp', 'Level 4 - Workshop', 'Level 4 - Exhibition/Demo Day'
];
const PROGRAM_THEMES = [
  'IPR & Technology Transfer', 'Innovation & Design Thinking', 'Entrepreneurship & Startup', 'Pre-Incubation & Incubation Management'
];

const EVENT_CATEGORIES = [
  'curricular', 'tlp', 'extended curricular activity', 'R & D', 'consultancy', 
  'alumini', 'industry linkage', 'IIC', 'sports', 'culturals', 'extension activity', 'others'
];

const TARGET_AUDIENCES = [
  'students', 'faculty', 'industry', 'alumini', 'community', 'others'
];

const FUNDING_SOURCES = [
  'institution', 'department', 'sponsership', 'participant fees', 'others'
];

const PROMOTION_STRATEGIES = [
  'posters', 'social media', 'email', 'others'
];

const SDG_GOALS = [
  'SDG 1: No Poverty',
  'SDG 2: Zero Hunger',
  'SDG 3: Good Health and Well-being',
  'SDG 4: Quality Education',
  'SDG 5: Gender Equality',
  'SDG 6: Clean Water and Sanitation',
  'SDG 7: Affordable and Clean Energy',
  'SDG 8: Decent Work and Economic Growth',
  'SDG 9: Industry, Innovation and Infrastructure',
  'SDG 10: Reduced Inequalities',
  'SDG 11: Sustainable Cities and Communities',
  'SDG 12: Responsible Consumption and Production',
  'SDG 13: Climate Action',
  'SDG 14: Life Below Water',
  'SDG 15: Life on Land',
  'SDG 16: Peace, Justice and Strong Institutions',
  'SDG 17: Partnerships for the Goals',
];

// --- Zod Schema ---

const coordinatorSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  contact: z.string().regex(/^\d{10}$/, 'Contact must be a 10-digit number'),
});

const speakerSchema = z.object({
  name: z.string().min(1, 'Speaker name is required'),
  details: z.string().min(1, 'Details (Designation/Organization) are required'),
  contact: z.string().regex(/^\d{10}$/, 'Contact must be a 10-digit number'),
});

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  
  // New Program Detail Fields
  academic_year: z.string().min(1, 'Academic year is required'),
  program_driven_by: z.string().min(1, 'This field is required'),
  quarter: z.string().min(1, 'This field is required'),
  program_type: z.string().min(1, 'This field is required'),
  program_theme: z.string().min(1, 'This field is required'),

  coordinators: z.array(coordinatorSchema).min(1, 'At least one coordinator is required'),
  speakers_list: z.array(speakerSchema).optional(),

  department_club: z.string().min(1, 'Department/Club/Society is required'),
  mode_of_event: z.enum(['online', 'offline', 'hybrid'], { required_error: 'Mode of event is required' }),
  category: z.array(z.string()).min(1, 'Select at least one category'),
  category_others: z.string().optional(),
  objective: z.string().min(1, 'Objective is required').max(99, 'Objective must be 99 characters or less.'), // Corrected limit
  sdg_alignment: z.array(z.string()).optional(),
  target_audience: z.array(z.string()).min(1, 'Select at least one target audience'),
  target_audience_others: z.string().optional(),
  expected_audience: z.coerce.number().int().positive('Must be a positive number').optional().nullable(),
  proposed_outcomes: z.string().min(1, 'Proposed outcomes are required').max(149, 'Proposed Outcomes must be 149 characters or less.'), // Corrected limit
  
  budget_estimate: z.coerce.number().min(0, 'Budget cannot be negative').optional().nullable(),
  funding_source: z.array(z.string()).optional(),
  funding_source_others: z.string().optional(),
  promotion_strategy: z.array(z.string()).min(1, 'Select at least one promotion strategy'),
  promotion_strategy_others: z.string().optional(),

  venue_id: z.string().min(1, 'Venue selection is required'),
  other_venue_details: z.string().optional(),
  event_date: z.string().min(1, 'From date is required'),
  end_date: z.string().optional().nullable(),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  
  poster_url: z.string().optional(),
  
  // New field for coordinator's resubmission reason
  coordinator_resubmission_reason: z.string().optional(), 
  status: z.string().optional(), // Added status to schema for validation logic
}).refine(data => {
    if (!data.end_date) return true;
    return data.end_date >= data.event_date;
  }, {
    message: "To date must be on or after From date",
    path: ["end_date"],
  })
.refine(data => {
    if (!data.end_date || data.event_date === data.end_date) {
      return data.end_time > data.start_time;
    }
    return true;
  }, {
    message: "End time must be after start time on the same day",
    path: ["end_time"],
  })
.refine(data => {
  if (data.budget_estimate && data.budget_estimate > 0) {
    return data.funding_source && data.funding_source.length > 0;
  }
  return true;
}, {
  message: "Funding source is required if budget estimate is greater than zero.",
  path: ["funding_source"],
}).superRefine((data, ctx) => {
  if (data.venue_id === 'other' && !data.other_venue_details?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Please specify the other venue details.',
      path: ['other_venue_details'],
    });
  }
  
  // Resubmission reason required if status is returned_to_coordinator
  if (data.status === 'returned_to_coordinator' && !data.coordinator_resubmission_reason?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'A reason for resubmission is mandatory.',
      path: ['coordinator_resubmission_reason'],
    });
  }
});

type FormSchema = z.infer<typeof formSchema>;

type Venue = {
  id: string;
  name: string;
};

type EventDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  event?: any | null;
  mode: 'create' | 'edit' | 'view';
};


const EventDialog = ({ isOpen, onClose, onSuccess, event, mode }: EventDialogProps) => {
  const { user, profile } = useAuth();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReasonDialogOpen, setIsReasonDialogOpen] = useState(false);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [isPosterDialogOpen, setIsPosterDialogOpen] = useState(false);
  
  const isEditMode = mode === 'edit';
  const isReadOnly = mode === 'view';
  const isCoordinator = profile?.role === 'coordinator';

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      academic_year: getAcademicYear(),
      program_driven_by: undefined,
      quarter: undefined,
      program_type: undefined,
      program_theme: undefined,
      department_club: '',
      mode_of_event: undefined,
      category: [],
      category_others: '',
      objective: '',
      sdg_alignment: [],
      target_audience: [],
      target_audience_others: '',
      expected_audience: undefined,
      proposed_outcomes: '',
      budget_estimate: undefined,
      funding_source: [],
      funding_source_others: '',
      promotion_strategy: [],
      promotion_strategy_others: '',
      venue_id: '',
      other_venue_details: '',
      event_date: '',
      end_date: '',
      start_time: '',
      end_time: '',
      coordinators: [{ name: '', contact: '' }],
      speakers_list: [{ name: '', details: '', contact: '' }],
      poster_url: '',
      coordinator_resubmission_reason: '', // Default value for new field
      status: 'pending_hod', // Default status for new event
    },
  });

  const { fields: coordinatorFields, append: appendCoordinator, remove: removeCoordinator } = useFieldArray({
    control: form.control,
    name: "coordinators",
  });

  const { fields: speakerFields, append: appendSpeaker, remove: removeSpeaker } = useFieldArray({
    control: form.control,
    name: "speakers_list",
  });

  const budgetEstimate = form.watch('budget_estimate');
  const requiresFundingSource = budgetEstimate && budgetEstimate > 0;
  const selectedVenueId = form.watch('venue_id');
  const currentPosterUrl = form.watch('poster_url');
  const academicYearOptions = getAcademicYearOptions();
  const objectiveValue = form.watch('objective');
  const outcomeValue = form.watch('proposed_outcomes');
  const objectiveCharCount = countCharacters(objectiveValue);
  const outcomeCharCount = countCharacters(outcomeValue);

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
    if (fileRejections.length > 0) {
      const rejection = fileRejections[0];
      if (rejection.errors.some((e: any) => e.code === 'file-too-large')) {
        toast.error('File size exceeds 1MB limit.');
      } else if (rejection.errors.some((e: any) => e.code === 'file-invalid-type')) {
        toast.error('Only JPEG files are supported.');
      } else {
        toast.error('File upload rejected.');
      }
      setPosterFile(null);
      return;
    }
    if (acceptedFiles.length > 0) {
      setPosterFile(acceptedFiles[0]);
      form.clearErrors('poster_url');
    }
  }, [form]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpeg', '.jpg'],
    },
    maxFiles: 1,
    maxSize: 1024 * 1024, // 1MB
    disabled: isReadOnly,
  });

  useEffect(() => {
    const fetchVenues = async () => {
      const { data, error } = await supabase.from('venues').select('id, name');
      if (error) {
        toast.error('Failed to fetch venues.');
      } else {
        setVenues(data);
      }
    };
    fetchVenues();
  }, []);

  useEffect(() => {
    if (event) {
      const parseArrayField = (field: string[] | null | undefined, options: string[]) => {
        const safeField = field || [];
        const othersValue = safeField.find(item => !options.includes(item));
        const baseValues = safeField.filter(item => options.includes(item));
        return { base: baseValues, other: othersValue || '' };
      };

      const parsedCategory = parseArrayField(event.category, EVENT_CATEGORIES);
      const parsedAudience = parseArrayField(event.target_audience, TARGET_AUDIENCES);
      const parsedFunding = parseArrayField(event.funding_source, FUNDING_SOURCES);
      const parsedPromotion = parseArrayField(event.promotion_strategy, PROMOTION_STRATEGIES);
      const parsedCoordinators = (event.coordinator_name || []).map((name: string, index: number) => ({ name, contact: (event.coordinator_contact || [])[index] || '' }));
      const parsedSpeakers = (event.speakers || []).map((name: string, index: number) => ({ name, details: (event.speaker_details || [])[index] || '', contact: (event.speaker_contacts || [])[index] || '' }));
      const isOtherVenue = !event.venue_id && event.other_venue_details;

      form.reset({
        ...event,
        academic_year: event.academic_year || getAcademicYear(),
        program_driven_by: event.program_driven_by || '',
        quarter: event.quarter || '',
        program_type: event.program_type || '',
        program_theme: event.program_theme || '',
        end_date: event.end_date || '',
        expected_audience: event.expected_audience ?? null,
        budget_estimate: event.budget_estimate ?? null,
        category: parsedCategory.base,
        category_others: parsedCategory.other,
        target_audience: parsedAudience.base,
        target_audience_others: parsedAudience.other,
        funding_source: parsedFunding.base,
        funding_source_others: parsedFunding.other,
        promotion_strategy: parsedPromotion.base,
        promotion_strategy_others: parsedPromotion.other,
        sdg_alignment: event.sdg_alignment || [],
        coordinators: parsedCoordinators.length > 0 ? parsedCoordinators : [{ name: '', contact: '' }],
        speakers_list: parsedSpeakers.length > 0 ? parsedSpeakers : [{ name: '', details: '', contact: '' }],
        venue_id: isOtherVenue ? 'other' : event.venue_id,
        other_venue_details: event.other_venue_details || '',
        poster_url: event.poster_url || '',
        coordinator_resubmission_reason: event.coordinator_resubmission_reason || '', // Load existing reason if any
        status: event.status, // Load status for validation logic
      });
      setPosterFile(null);
    } else {
      const defaultDeptClub = profile?.department || profile?.club || profile?.professional_society || '';
      form.reset({
        academic_year: getAcademicYear(),
        coordinators: [{ name: '', contact: '' }],
        speakers_list: [{ name: '', details: '', contact: '' }],
        department_club: defaultDeptClub,
        category: [],
        sdg_alignment: [],
        target_audience: [],
        funding_source: [],
        promotion_strategy: [],
        expected_audience: undefined,
        budget_estimate: undefined,
        poster_url: '',
        coordinator_resubmission_reason: '',
        status: 'pending_hod', // Default status for new event
      });
      setPosterFile(null);
    }
  }, [event, form, profile]);

  const uploadPoster = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const filePath = `${user!.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('event_posters')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Poster upload failed: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('event_posters')
      .getPublicUrl(filePath);
      
    return publicUrl;
  };

  const onSubmit = async (values: FormSchema) => {
    if (!user) return;
    setIsSubmitting(true);

    let finalPosterUrl = values.poster_url;

    try {
      if (posterFile) {
        finalPosterUrl = await uploadPoster(posterFile);
      } else if (!finalPosterUrl) {
        form.setError('poster_url', { type: 'manual', message: 'Event poster is mandatory.' });
        setIsSubmitting(false);
        return;
      }

      const transformArrayField = (base: string[], other: string | undefined) => {
        const result = [...base];
        if (other?.trim()) result.push(other.trim());
        return result;
      };

      const finalCategory = transformArrayField(values.category, values.category_others);
      const finalAudience = transformArrayField(values.target_audience, values.target_audience_others);
      const finalFunding = transformArrayField(values.funding_source || [], values.funding_source_others);
      const finalPromotion = transformArrayField(values.promotion_strategy, values.promotion_strategy_others);
      const coordinatorNames = values.coordinators.map(c => c.name);
      const coordinatorContacts = values.coordinators.map(c => c.contact);
      const speakerNames = values.speakers_list?.map(s => s.name) || [];
      const speakerDetails = values.speakers_list?.map(s => s.details) || [];
      const speakerContacts = values.speakers_list?.map(s => s.contact) || [];

      const eventData = {
        title: values.title,
        description: values.description,
        academic_year: values.academic_year,
        program_driven_by: values.program_driven_by,
        quarter: values.quarter,
        program_type: values.program_type,
        program_theme: values.program_theme,
        event_date: values.event_date,
        end_date: values.end_date || null,
        start_time: values.start_time,
        end_time: values.end_time,
        expected_audience: values.expected_audience,
        department_club: values.department_club,
        coordinator_name: coordinatorNames,
        coordinator_contact: coordinatorContacts,
        mode_of_event: values.mode_of_event,
        category: finalCategory,
        objective: values.objective,
        sdg_alignment: values.sdg_alignment,
        target_audience: finalAudience,
        proposed_outcomes: values.proposed_outcomes,
        speakers: speakerNames,
        speaker_details: speakerDetails,
        speaker_contacts: speakerContacts,
        budget_estimate: values.budget_estimate || 0,
        funding_source: finalFunding,
        promotion_strategy: finalPromotion,
        hod_approval_at: null,
        dean_approval_at: null,
        principal_approval_at: null,
        venue_id: values.venue_id === 'other' ? null : values.venue_id,
        other_venue_details: values.venue_id === 'other' ? values.other_venue_details : null,
        poster_url: finalPosterUrl,
        // Include the new resubmission reason field
        coordinator_resubmission_reason: values.coordinator_resubmission_reason || null,
      };

      const { data: isAvailable, error: checkError } = await supabase.rpc('check_venue_availability', {
        p_venue_id: values.venue_id === 'other' ? null : values.venue_id,
        p_start_date: values.event_date,
        p_end_date: values.end_date || values.event_date,
        p_start_time: values.start_time,
        p_end_time: values.end_time,
        p_event_id: isEditMode ? event.id : null,
      });

      if (checkError || (values.venue_id !== 'other' && !isAvailable)) {
        toast.error('Venue is not available at the selected date and time.');
        setIsSubmitting(false);
        return;
      }

      let error;
      if (isEditMode) {
        // When resubmitting a returned event, set status to 'resubmitted' and reset approvals
        let newStatus: 'pending_hod' | 'resubmitted' = 'pending_hod';
        if (event.status === 'returned_to_coordinator') {
          newStatus = 'resubmitted';
        }
        
        const { error: updateError } = await supabase.from('events').update({ 
          ...eventData, 
          status: newStatus, 
          remarks: null, // Clear previous remarks upon resubmission
          hod_approval_at: null,
          dean_approval_at: null,
          principal_approval_at: null,
        }).eq('id', event.id);
        error = updateError;
      } else {
        // For new events, clear the resubmission reason
        const { error: insertError } = await supabase.from('events').insert({ 
          ...eventData, 
          submitted_by: user.id,
          coordinator_resubmission_reason: null,
        });
        error = insertError;
      }

      if (error) {
        toast.error(`Failed to save event: ${error.message}`);
      } else {
        toast.success(`Event ${isEditMode ? 'updated and resubmitted' : 'created'} successfully.`);
        onSuccess();
        onClose();
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDialogTitle = () => {
    switch (mode) {
      case 'view': return 'View Event Details';
      case 'edit': return 'Edit Event';
      default: return 'Create New Event';
    }
  };

  const getDialogDescription = () => {
    const submitterName = event?.profiles ? `${event.profiles.first_name} ${event.profiles.last_name}` : 'N/A';
    switch (mode) {
      case 'view': return `Viewing details for: ${event?.title || 'event'}. Submitted by: ${submitterName}`;
      case 'edit': return 'Make changes and resubmit for approval.';
      default: return 'Fill out the form below to create a new event.';
    }
  };

  const renderDepartmentClubField = () => {
    if (isReadOnly && event) {
      return <FormItem><FormLabel>Organizing Department/Club/Society</FormLabel><Input value={event.department_club || 'N/A'} disabled /></FormItem>;
    }
    if (!isCoordinator) {
      return <Alert variant="destructive"><AlertTitle>Access Denied</AlertTitle><AlertDescription>Only users with the 'coordinator' role can create events.</AlertDescription></Alert>;
    }
    return <FormField control={form.control} name="department_club" render={({ field }) => (<FormItem><FormLabel>Organizing Department/Club/Society</FormLabel><FormControl><Input placeholder="Enter department, club, or society name" {...field} disabled={isReadOnly} /></FormControl><FormMessage /></FormItem>)} />;
  };
  
  const isReturnedOrRejected = event && ['returned_to_coordinator', 'returned_to_hod', 'returned_to_dean', 'rejected'].includes(event.status);
  const isReturnedToCoordinator = event && event.status === 'returned_to_coordinator';

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{getDialogTitle()}</DialogTitle>
            <DialogDescription>{getDialogDescription()}</DialogDescription>
          </DialogHeader>

          {(isEditMode || isReadOnly) && isReturnedOrRejected && (
            <Alert variant="destructive">
              <Terminal className="h-4 w-4" />
              <AlertTitle>Event Status: {event.status.replace(/_/g, ' ').replace('dean', 'Dean IR').toUpperCase()}</AlertTitle>
              <AlertDescription>
                This event was returned or rejected. Please review the remarks below or click "View Remarks History" for details.
              </AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className="md:col-span-2 space-y-4">
                  <h3 className="text-lg font-semibold border-b pb-2">Basic Information</h3>
                  <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Event Title</FormLabel><FormControl><Input placeholder="Event Title" {...field} disabled={isReadOnly} /></FormControl><FormMessage /></FormItem>)} />
                </div>

                <div className="md:col-span-2">{renderDepartmentClubField()}</div>

                <div className="space-y-4 md:col-span-2 border p-4 rounded-lg">
                  <h3 className="text-lg font-semibold border-b pb-2">Event Coordinators</h3>
                  {coordinatorFields.map((item, index) => (
                    <div key={item.id} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end border-b pb-4 last:border-b-0 last:pb-0">
                      <FormField control={form.control} name={`coordinators.${index}.name`} render={({ field }) => (<FormItem className="sm:col-span-1"><FormLabel>Coordinator Name</FormLabel><FormControl><Input placeholder="Coordinator Name" {...field} disabled={isReadOnly} /></FormControl><FormMessage /></FormItem>)} />
                      <FormField control={form.control} name={`coordinators.${index}.contact`} render={({ field }) => (<FormItem className="sm:col-span-1"><FormLabel>Contact Number (10 digits)</FormLabel><FormControl><Input type="tel" placeholder="9876543210" {...field} disabled={isReadOnly} /></FormControl><FormMessage /></FormItem>)} />
                      <div className="flex justify-end sm:col-span-1">{!isReadOnly && coordinatorFields.length > 1 && (<Button type="button" variant="destructive" size="icon" onClick={() => removeCoordinator(index)}><Trash2 className="h-4 w-4" /></Button>)}</div>
                    </div>
                  ))}
                  {!isReadOnly && (<Button type="button" variant="outline" onClick={() => appendCoordinator({ name: '', contact: '' })} className="w-full mt-2"><Plus className="mr-2 h-4 w-4" /> Add New Coordinator</Button>)}
                </div>

                <div className="space-y-4 md:col-span-2">
                  <h3 className="text-lg font-semibold border-b pb-2">Program Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="academic_year" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Academic Year</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={isReadOnly}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Academic Year" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {academicYearOptions.map(year => (
                              <SelectItem key={year} value={year}>{year}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="program_driven_by" render={({ field }) => (<FormItem><FormLabel>Program Driven By</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isReadOnly}><FormControl><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger></FormControl><SelectContent>{PROGRAM_DRIVEN_BY.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="quarter" render={({ field }) => (<FormItem><FormLabel>Quarter</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isReadOnly}><FormControl><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger></FormControl><SelectContent>{QUARTERS.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="program_theme" render={({ field }) => (<FormItem><FormLabel>Program Theme</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isReadOnly}><FormControl><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger></FormControl><SelectContent>{PROGRAM_THEMES.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    <div className="md:col-span-2">
                      <FormField control={form.control} name="program_type" render={({ field }) => (<FormItem><FormLabel>Program Type</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isReadOnly}><FormControl><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger></FormControl><SelectContent>{PROGRAM_TYPES.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 md:col-span-2">
                  <h3 className="text-lg font-semibold border-b pb-2">Schedule & Location</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="event_date" render={({ field }) => (
                      <FormItem>
                        <FormLabel>From Date</FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            {...field} 
                            disabled={isReadOnly} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="end_date" render={({ field }) => (
                      <FormItem>
                        <FormLabel>To Date (optional)</FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            {...field} 
                            disabled={isReadOnly} 
                            value={field.value ?? ''} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="start_time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Time</FormLabel>
                          <FormControl>
                            <TimePicker
                              value={field.value}
                              onChange={field.onChange}
                              disabled={isReadOnly}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="end_time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Time</FormLabel>
                          <FormControl>
                            <TimePicker
                              value={field.value}
                              onChange={field.onChange}
                              disabled={isReadOnly}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField control={form.control} name="venue_id" render={({ field }) => (<FormItem><FormLabel>Venue</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={isReadOnly}><FormControl><SelectTrigger><SelectValue placeholder="Select a venue" /></SelectTrigger></FormControl><SelectContent>{venues.map((venue) => (<SelectItem key={venue.id} value={venue.id}>{venue.name}</SelectItem>))}<SelectItem value="other">Other</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                  {selectedVenueId === 'other' && (<FormField control={form.control} name="other_venue_details" render={({ field }) => (<FormItem><FormLabel>Other Venue Details</FormLabel><FormControl><Textarea placeholder="Please specify the venue name and location" {...field} disabled={isReadOnly} /></FormControl><FormMessage /></FormItem>)} />)}
                </div>

                <div className="space-y-4 md:col-span-2">
                  <h3 className="text-lg font-semibold border-b pb-2">Event Mode</h3>
                  <FormField control={form.control} name="mode_of_event" render={({ field }) => (<FormItem className="space-y-3"><FormLabel>Mode of Event</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex space-x-4" disabled={isReadOnly}><FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="online" /></FormControl><FormLabel className="font-normal">Online</FormLabel></FormItem><FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="offline" /></FormControl><FormLabel className="font-normal">Offline</FormLabel></FormItem><FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="hybrid" /></FormControl><FormLabel className="font-normal">Hybrid</FormLabel></FormItem></RadioGroup></FormControl><FormMessage /></FormItem>)} />
                </div>

                <div className="space-y-4 md:col-span-2">
                  <h3 className="text-lg font-semibold border-b pb-2">Event Category</h3>
                  <FormField control={form.control} name="category" render={() => (<FormItem><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">{EVENT_CATEGORIES.map((item) => (<FormField key={item} control={form.control} name="category" render={({ field }) => (<FormItem key={item} className="flex flex-row items-start space-x-3 space-y-0"><FormControl><Checkbox checked={field.value?.includes(item)} onCheckedChange={(checked) => { const currentValues = field.value ?? []; return checked ? field.onChange([...currentValues, item]) : field.onChange(currentValues.filter((value) => value !== item)); }} disabled={isReadOnly} /></FormControl><FormLabel className="font-normal capitalize">{item.replace(/_/g, ' ')}</FormLabel></FormItem>)} />))}</div>{form.watch('category').includes('others') && (<FormField control={form.control} name="category_others" render={({ field }) => (<FormItem className="mt-2"><FormLabel>Specify Other Category</FormLabel><FormControl><Input {...field} disabled={isReadOnly} /></FormControl></FormItem>)} />)}<FormMessage /></FormItem>)} />
                </div>

                <div className="space-y-4 md:col-span-2">
                  <FormField control={form.control} name="objective" render={({ field }) => (
                    <FormItem>
                      <div className="flex justify-between items-center">
                        <FormLabel>Objective of the Event</FormLabel>
                        <span className={cn("text-xs", objectiveCharCount > 99 ? 'text-destructive' : 'text-muted-foreground')}>
                          {objectiveCharCount} / 99 characters
                        </span>
                      </div>
                      <FormControl>
                        <Textarea 
                          placeholder="State the main objective" 
                          {...field} 
                          disabled={isReadOnly} 
                          maxLength={99} // Enforce max length
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                
                <div className="space-y-4 md:col-span-2">
                  <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Key Indicator / Detailed Description</FormLabel><FormControl><Textarea placeholder="Detailed description of the event" {...field} disabled={isReadOnly} /></FormControl><FormMessage /></FormItem>)} />
                </div>

                <div className="space-y-4 md:col-span-2">
                  <h3 className="text-lg font-semibold border-b pb-2">Alignment with SDGs</h3>
                  <FormField control={form.control} name="sdg_alignment" render={() => (<FormItem><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">{SDG_GOALS.map((item) => (<FormField key={item} control={form.control} name="sdg_alignment" render={({ field }) => (<FormItem key={item} className="flex flex-row items-start space-x-3 space-y-0"><FormControl><Checkbox checked={field.value?.includes(item)} onCheckedChange={(checked) => { const currentValues = field.value ?? []; return checked ? field.onChange([...currentValues, item]) : field.onChange(currentValues.filter((value) => value !== item)); }} disabled={isReadOnly} /></FormControl><FormLabel className="font-normal">{item}</FormLabel></FormItem>)} />))}</div><FormMessage /></FormItem>)} />
                </div>

                <div className="space-y-4 md:col-span-2">
                  <h3 className="text-lg font-semibold border-b pb-2">Target Audience</h3>
                  <FormField control={form.control} name="target_audience" render={() => (<FormItem><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">{TARGET_AUDIENCES.map((item) => (<FormField key={item} control={form.control} name="target_audience" render={({ field }) => (<FormItem key={item} className="flex flex-row items-start space-x-3 space-y-0"><FormControl><Checkbox checked={field.value?.includes(item)} onCheckedChange={(checked) => { const currentValues = field.value ?? []; return checked ? field.onChange([...currentValues, item]) : field.onChange(currentValues.filter((value) => value !== item)); }} disabled={isReadOnly} /></FormControl><FormLabel className="font-normal capitalize">{item}</FormLabel></FormItem>)} />))}</div>{form.watch('target_audience').includes('others') && (<FormField control={form.control} name="target_audience_others" render={({ field }) => (<FormItem className="mt-2"><FormLabel>Specify Other Audience</FormLabel><FormControl><Input {...field} disabled={isReadOnly} /></FormControl></FormItem>)} />)}<FormMessage /></FormItem>)} />
                </div>

                <div className="space-y-4 md:col-span-2">
                  <FormField control={form.control} name="expected_audience" render={({ field }) => (<FormItem><FormLabel>Expected No. of Participants</FormLabel><FormControl><Input type="number" placeholder="e.g., 100" {...field} disabled={isReadOnly} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)} /></FormControl><FormMessage /></FormItem>)} />
                </div>

                <div className="space-y-4 md:col-span-2">
                  <FormField control={form.control} name="proposed_outcomes" render={({ field }) => (
                    <FormItem>
                      <div className="flex justify-between items-center">
                        <FormLabel>Proposed Outcomes</FormLabel>
                        <span className={cn("text-xs", outcomeCharCount > 149 ? 'text-destructive' : 'text-muted-foreground')}>
                          {outcomeCharCount} / 149 characters
                        </span>
                      </div>
                      <FormControl>
                        <Textarea 
                          placeholder="Expected results or benefits" 
                          {...field} 
                          disabled={isReadOnly} 
                          maxLength={149} // Enforce max length
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="space-y-4 md:col-span-2 border p-4 rounded-lg">
                  <h3 className="text-lg font-semibold border-b pb-2">Speakers / Resource Person Details</h3>
                  {speakerFields.map((item, index) => (
                    <div key={item.id} className="space-y-2 border-b pb-4 last:border-b-0 last:pb-0">
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                        <FormField control={form.control} name={`speakers_list.${index}.name`} render={({ field }) => (<FormItem className="sm:col-span-2"><FormLabel>Speaker Name</FormLabel><FormControl><Input placeholder="Speaker Name" {...field} disabled={isReadOnly} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name={`speakers_list.${index}.contact`} render={({ field }) => (<FormItem className="sm:col-span-1"><FormLabel>Contact Number</FormLabel><FormControl><Input type="tel" placeholder="9876543210" {...field} disabled={isReadOnly} /></FormControl><FormMessage /></FormItem>)} />
                        <div className="flex justify-end sm:col-span-1">{!isReadOnly && speakerFields.length > 1 && (<Button type="button" variant="destructive" size="icon" onClick={() => removeSpeaker(index)}><Trash2 className="h-4 w-4" /></Button>)}</div>
                      </div>
                      <FormField control={form.control} name={`speakers_list.${index}.details`} render={({ field }) => (<FormItem><FormLabel>Designation/Organization</FormLabel><FormControl><Textarea placeholder="e.g., Professor, Dept. of CSE, IIT Madras" {...field} disabled={isReadOnly} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                  ))}
                  {!isReadOnly && (<Button type="button" variant="outline" onClick={() => appendSpeaker({ name: '', details: '', contact: '' })} className="w-full mt-2"><Plus className="mr-2 h-4 w-4" /> Add New Speaker</Button>)}
                </div>

                <div className="space-y-4 md:col-span-2">
                  <h3 className="text-lg font-semibold border-b pb-2">Budget & Funding</h3>
                  <FormField control={form.control} name="budget_estimate" render={({ field }) => (<FormItem><FormLabel>Budget Estimate (in Rupees)</FormLabel><FormControl><Input type="number" placeholder="0" {...field} disabled={isReadOnly} value={field.value ?? ''} onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)} /></FormControl><FormMessage /></FormItem>)} />
                  <div className={cn(!requiresFundingSource && 'opacity-50 pointer-events-none', 'transition-opacity')}><FormField control={form.control} name="funding_source" render={() => (<FormItem><FormLabel>Funding Source (Required if budget &gt; 0)</FormLabel><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">{FUNDING_SOURCES.map((item) => (<FormField key={item} control={form.control} name="funding_source" render={({ field }) => (<FormItem key={item} className="flex flex-row items-start space-x-3 space-y-0"><FormControl><Checkbox checked={field.value?.includes(item)} onCheckedChange={(checked) => { const currentValues = field.value ?? []; return checked ? field.onChange([...currentValues, item]) : field.onChange(currentValues.filter((value) => value !== item)); }} disabled={isReadOnly || !requiresFundingSource} /></FormControl><FormLabel className="font-normal capitalize">{item.replace(/_/g, ' ')}</FormLabel></FormItem>)} />))}</div>{form.watch('funding_source')?.includes('others') && (<FormField control={form.control} name="funding_source_others" render={({ field }) => (<FormItem className="mt-2"><FormLabel>Specify Other Funding Source</FormLabel><FormControl><Textarea {...field} disabled={isReadOnly} /></FormControl></FormItem>)} />)}<FormMessage /></FormItem>)} /></div>
                </div>

                <div className="space-y-4 md:col-span-2">
                  <h3 className="text-lg font-semibold border-b pb-2">Event Promotion Strategy</h3>
                  <FormField control={form.control} name="promotion_strategy" render={() => (<FormItem><div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">{PROMOTION_STRATEGIES.map((item) => (<FormField key={item} control={form.control} name="promotion_strategy" render={({ field }) => (<FormItem key={item} className="flex flex-row items-start space-x-3 space-y-0"><FormControl><Checkbox checked={field.value?.includes(item)} onCheckedChange={(checked) => { const currentValues = field.value ?? []; return checked ? field.onChange([...currentValues, item]) : field.onChange(currentValues.filter((value) => value !== item)); }} disabled={isReadOnly} /></FormControl><FormLabel className="font-normal capitalize">{item.replace(/_/g, ' ')}</FormLabel></FormItem>)} />))}</div>{form.watch('promotion_strategy').includes('others') && (<FormField control={form.control} name="promotion_strategy_others" render={({ field }) => (<FormItem className="mt-2"><FormLabel>Specify Other Promotion Strategy</FormLabel><FormControl><Input {...field} disabled={isReadOnly} /></FormControl></FormItem>)} />)}<FormMessage /></FormItem>)} />
                </div>
                
                <div className="space-y-4 md:col-span-2 pt-4 border-t">
                  <h3 className="text-lg font-semibold border-b pb-2">Event Poster (Mandatory JPEG, Max 1MB)</h3>
                  
                  {isReadOnly ? (
                    <div className="flex items-center justify-between p-3 border rounded-md bg-muted">
                      <p className="text-sm">{currentPosterUrl ? 'Poster uploaded.' : 'No poster uploaded.'}</p>
                      {currentPosterUrl && (
                        <Button type="button" variant="outline" size="sm" onClick={() => setIsPosterDialogOpen(true)}>
                          <Image className="h-4 w-4 mr-2" /> View Poster
                        </Button>
                      )}
                    </div>
                  ) : (
                    <FormField
                      control={form.control}
                      name="poster_url"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <div
                              {...getRootProps()}
                              className={cn(
                                'p-8 border-2 border-dashed rounded-md text-center cursor-pointer transition-colors',
                                isDragActive ? 'border-primary bg-primary/10' : 'border-border',
                                form.formState.errors.poster_url && 'border-destructive'
                              )}
                            >
                              <input {...getInputProps()} />
                              {posterFile ? (
                                <p className="text-sm font-medium">{posterFile.name}</p>
                              ) : currentPosterUrl ? (
                                <p className="text-sm text-green-600">Existing poster uploaded. Click to replace.</p>
                              ) : (
                                <p>Drag 'n' drop JPEG poster here, or click to select file (Max 1MB)</p>
                              )}
                            </div>
                          </FormControl>
                          <FormMessage>{form.formState.errors.poster_url?.message}</FormMessage>
                          {currentPosterUrl && !posterFile && (
                            <Button type="button" variant="link" size="sm" onClick={() => setIsPosterDialogOpen(true)} className="p-0 h-auto">
                              View Current Poster
                            </Button>
                          )}
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </div>

              {(isEditMode || isReadOnly) && event && (
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-lg font-semibold border-b pb-2">Approval Status</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <FormItem><FormLabel>HOD Approval</FormLabel><Input value={event.hod_approval_at ? `Approved on ${format(new Date(event.hod_approval_at), 'PPP p')}` : 'Pending'} disabled className={cn(event.hod_approval_at ? 'border-green-500' : 'border-yellow-500')} /></FormItem>
                    <FormItem><FormLabel>Dean IR Approval</FormLabel><Input value={event.dean_approval_at ? `Approved on ${format(new Date(event.dean_approval_at), 'PPP p')}` : 'Pending'} disabled className={cn(event.dean_approval_at ? 'border-green-500' : 'border-yellow-500')} /></FormItem>
                    <FormItem><FormLabel>Principal Approval</FormLabel><Input value={event.principal_approval_at ? `Approved on ${format(new Date(event.principal_approval_at), 'PPP p')}` : 'Pending'} disabled className={cn(event.principal_approval_at ? 'border-green-500' : 'border-yellow-500')} /></FormItem>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormItem>
                      <div className="flex justify-between items-center">
                        <FormLabel>Last Approver Remarks (Uneditable)</FormLabel>
                        {isReturnedOrRejected && (
                          <Button 
                            type="button" 
                            variant="link" 
                            size="sm" 
                            onClick={() => setIsReasonDialogOpen(true)}
                            className="p-0 h-auto"
                          >
                            <MessageSquare className="h-4 w-4 mr-1" /> View Remarks History
                          </Button>
                        )}
                      </div>
                      <Textarea value={event.remarks || 'N/A'} disabled />
                    </FormItem>
                    
                    {isReturnedToCoordinator && (
                      <FormField
                        control={form.control}
                        name="coordinator_resubmission_reason"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Reason for Resubmission (Mandatory)</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Explain the changes made and why this event should be approved now." 
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                </div>
              )}

              <DialogFooter>
                {isReadOnly ? (<Button type="button" variant="outline" onClick={onClose}>Close</Button>) : (<><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Submitting...' : (isEditMode ? 'Update & Resubmit' : 'Submit for Approval')}</Button></>)}
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {event && currentPosterUrl && (
        <PosterDialog
          isOpen={isPosterDialogOpen}
          onClose={() => setIsPosterDialogOpen(false)}
          posterUrl={currentPosterUrl}
          eventTitle={event.title}
        />
      )}
      
      {event && isReasonDialogOpen && (
        <ReturnReasonDialog
          isOpen={isReasonDialogOpen}
          onClose={() => setIsReasonDialogOpen(false)}
          event={event}
        />
      )}
    </>
  );
};

export default EventDialog;