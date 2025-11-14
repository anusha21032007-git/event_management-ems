import { useState, useCallback, useMemo, useRef } from 'react';
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
  FormDescription,
} from '@/components/ui/form';
import { toast } from 'sonner';
import { Download, UploadCloud, Loader2, Image, Users, Twitter, Facebook, Instagram, Linkedin } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { format, isPast, differenceInHours, parseISO, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const MAX_PHOTOS = 4;
const MAX_PHOTO_SIZE = 2 * 1024 * 1024; // 2MB

const ACTIVITY_LEAD_BY_OPTIONS = [
  'Institute Council',
  'Student Council',
];

const socialMediaPlatforms = [
  { id: 'twitter', label: 'Twitter', icon: Twitter },
  { id: 'facebook', label: 'Facebook', icon: Facebook },
  { id: 'instagram', label: 'Instagram', icon: Instagram },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin },
] as const;

const formSchema = z.object({
  student_participants: z.coerce.number().int().min(0, 'Cannot be negative'),
  faculty_participants: z.coerce.number().int().min(0, 'Cannot be negative'),
  external_participants: z.coerce.number().int().min(0, 'Cannot be negative'),
  activity_lead_by: z.string().min(1, 'Activity lead is required'),
  final_report_remarks: z.string().optional(),
  photos: z.array(z.instanceof(File)).min(1, 'At least one photo is required').max(MAX_PHOTOS),
  social_media_selection: z.array(z.string()).optional(),
  twitter_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  facebook_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  instagram_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  linkedin_url: z.string().url('Invalid URL').optional().or(z.literal('')),
});

type ReportFormData = z.infer<typeof formSchema>;

type ReportData = {
  aiObjective: string;
  photoUrls: string[];
  formData: ReportFormData;
  durationHours: number;
};

type EventReportGeneratorDialogProps = {
  event: any;
  isOpen: boolean;
  onClose: () => void;
};

// Helper function to calculate duration in hours
const calculateDurationHours = (event: any): number => {
  if (!event.event_date || !event.start_time || !event.end_time) return 0;

  try {
    const startDate = parseISO(event.event_date);
    const endDate = event.end_date ? parseISO(event.end_date) : startDate;

    const [startH, startM] = event.start_time.split(':').map(Number);
    const [endH, endM] = event.end_time.split(':').map(Number);

    // 1. Calculate daily duration (in milliseconds)
    const startOfDay = new Date(2000, 0, 1, startH, startM).getTime();
    const endOfDay = new Date(2000, 0, 1, endH, endM).getTime();
    
    // Handle overnight events (e.g., 10 PM to 2 AM) - though unlikely for this context, we ensure end > start
    let dailyDurationMs = endOfDay - startOfDay;
    if (dailyDurationMs < 0) {
      // If end time is before start time, assume it spans midnight (e.g., 9 PM to 4 AM)
      dailyDurationMs += 24 * 60 * 60 * 1000; 
    }

    const dailyDurationHours = dailyDurationMs / (1000 * 60 * 60);

    // 2. Calculate total number of days (inclusive)
    const totalDays = differenceInDays(endDate, startDate) + 1;

    // 3. Calculate total duration
    const totalDuration = dailyDurationHours * totalDays;

    return Math.max(1, Math.round(totalDuration * 10) / 10); // Round to one decimal place, minimum 1 hour
  } catch (e) {
    console.error("Error calculating duration:", e);
    return 1;
  }
};


const EventReportGeneratorDialog = ({ event, isOpen, onClose }: EventReportGeneratorDialogProps) => {
  const [step, setStep] = useState(1); // 1: Form, 2: Preview
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);
  
  const durationHours = useMemo(() => calculateDurationHours(event), [event]);

  const form = useForm<ReportFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      student_participants: event?.student_participants ?? 0,
      faculty_participants: event?.faculty_participants ?? 0,
      external_participants: event?.external_participants ?? 0,
      activity_lead_by: event?.activity_lead_by || '',
      final_report_remarks: event?.final_report_remarks || '',
      photos: [],
      social_media_selection: [],
      twitter_url: '',
      facebook_url: '',
      instagram_url: '',
      linkedin_url: '',
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const currentFiles = form.getValues('photos') || [];
    const newFiles = [...currentFiles, ...acceptedFiles].slice(0, MAX_PHOTOS);
    form.setValue('photos', newFiles, { shouldValidate: true });
  }, [form]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': ['.jpeg', '.jpg'], 'image/png': ['.png'] },
    maxFiles: MAX_PHOTOS,
    maxSize: MAX_PHOTO_SIZE,
  });

  const removePhoto = (index: number) => {
    const currentFiles = form.getValues('photos');
    const newFiles = currentFiles.filter((_, i) => i !== index);
    form.setValue('photos', newFiles, { shouldValidate: true });
  };

  const handleGenerateReport = async (formData: ReportFormData) => {
    setIsGenerating(true);
    
    let aiObjective = '';

    try {
      // 1. Upload Photos to Supabase Storage
      const photoUploadPromises = formData.photos.map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${event.id}_report_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const { data, error } = await supabase.storage.from('event_reports').upload(fileName, file);
        if (error) throw new Error(`Photo upload failed: ${error.message}`);
        return supabase.storage.from('event_reports').getPublicUrl(data.path).data.publicUrl;
      });
      const photoUrls = await Promise.all(photoUploadPromises);

      // 2. Call Supabase Edge Function for AI Objective
      const { data: aiData, error: aiError } = await supabase.functions.invoke('generate-report-objective', {
        body: {
          title: event.title,
          objective: event.objective,
          description: event.description,
        },
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (aiError) {
        throw new Error(`AI service failed: ${aiError.message}`);
      }
      if (aiData.error) {
        throw new Error(`AI service returned an error: ${aiData.error}`);
      }
      aiObjective = aiData.objective;

      // 3. Prepare Social Media Links
      const social_media_links: { [key: string]: string } = {};
      if (formData.twitter_url) social_media_links.twitter = formData.twitter_url;
      if (formData.facebook_url) social_media_links.facebook = formData.facebook_url;
      if (formData.instagram_url) social_media_links.instagram = formData.instagram_url;
      if (formData.linkedin_url) social_media_links.linkedin = formData.linkedin_url;

      // 4. Update Event Record in DB
      const { error: updateError } = await supabase
        .from('events')
        .update({
          student_participants: formData.student_participants,
          faculty_participants: formData.faculty_participants,
          external_participants: formData.external_participants,
          activity_lead_by: formData.activity_lead_by,
          activity_duration_hours: durationHours, // Use calculated duration
          final_report_remarks: formData.final_report_remarks,
          report_photo_urls: photoUrls,
          social_media_links,
        })
        .eq('id', event.id);
      if (updateError) throw updateError;

      setReportData({ aiObjective, photoUrls, formData, durationHours });
      setStep(2);
    } catch (e: any) {
      toast.error(`Report generation failed: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    if (!reportRef.current) return;
    const printContents = reportRef.current.innerHTML;
    const printableContainer = document.createElement('div');
    printableContainer.className = 'printable-container';
    printableContainer.innerHTML = printContents;
    document.body.appendChild(printableContainer);
    toast.info("Your browser's print dialog will open. Please select 'Save as PDF'.");
    setTimeout(() => {
      window.print();
      document.body.removeChild(printableContainer);
    }, 500);
  };

  const renderReportContent = () => {
    if (!reportData) return null;
    const { aiObjective, photoUrls, formData, durationHours } = reportData;
    const totalParticipants = formData.student_participants + formData.faculty_participants + formData.external_participants;

    return (
      <div className="printable-report bg-white text-black p-8 font-serif" ref={reportRef}>
        {/* Header */}
        <header className="flex justify-between items-center border-b-2 border-black pb-2">
          <img src="/ace.jpeg" alt="ACE Logo" className="h-28 w-28 object-contain" />
          <div className="text-center">
            <h1 className="text-2xl font-bold">ADHIYAMAAN COLLEGE OF ENGINEERING</h1>
            <p className="text-sm font-semibold">(An Autonomous Institution)</p>
            <p className="text-xs">Affiliated to Anna University, Chennai</p>
            <p className="text-xs">Dr. M. G. R. Nagar, Hosur - 635130</p>
          </div>
          <img src="/iic.jpg" alt="IIC Logo" className="h-28 w-28 object-contain" />
        </header>

        {/* Titles */}
        <div className="text-center my-4">
          <h2 className="text-xl font-bold">Institution's Innovation Council</h2>
          <h3 className="text-lg">Activity Report Copy</h3>
        </div>

        {/* Section 1: Event Details (Improved Alignment and Spacing) */}
        <section className="p-2">
          <div className="text-sm space-y-1">
            {/* Row 1 */}
            <div className="grid grid-cols-4 border-b border-gray-200 pb-1">
              <span className="font-bold col-span-2">Academic Year:</span><span className="col-span-2">{event.academic_year}</span>
            </div>
            {/* Row 2 */}
            <div className="grid grid-cols-4 border-b border-gray-200 pb-1">
              <span className="font-bold col-span-2">Program Driven By:</span><span className="col-span-2">{event.program_driven_by}</span>
            </div>
            {/* Row 3 */}
            <div className="grid grid-cols-4 border-b border-gray-200 pb-1">
              <span className="font-bold col-span-2">Quarter:</span><span className="col-span-2">{event.quarter}</span>
            </div>
            {/* Row 4 */}
            <div className="grid grid-cols-4 border-b border-gray-200 pb-1">
              <span className="font-bold col-span-2">Program/Activity Name:</span><span className="col-span-2">{event.title}</span>
            </div>
            {/* Row 5 */}
            <div className="grid grid-cols-4 border-b border-gray-200 pb-1">
              <span className="font-bold col-span-2">Program Type:</span><span className="col-span-2">{event.program_type}</span>
            </div>
            {/* Row 6 */}
            <div className="grid grid-cols-4 border-b border-gray-200 pb-1">
              <span className="font-bold col-span-2">Activity Lead By:</span><span className="col-span-2">{formData.activity_lead_by}</span>
            </div>
            {/* Row 7 */}
            <div className="grid grid-cols-4 border-b border-gray-200 pb-1">
              <span className="font-bold col-span-2">Program Theme:</span><span className="col-span-2">{event.program_theme}</span>
            </div>
            {/* Row 8 */}
            <div className="grid grid-cols-4 border-b border-gray-200 pb-1">
              <span className="font-bold col-span-2">Duration (hours):</span><span className="col-span-2">{durationHours}</span>
            </div>
            {/* Row 9 */}
            <div className="grid grid-cols-4 border-b border-gray-200 pb-1">
              <span className="font-bold col-span-2">Start Date:</span><span className="col-span-2">{format(new Date(event.event_date), 'dd-MM-yyyy')}</span>
            </div>
            {/* Row 10 */}
            <div className="grid grid-cols-4 border-b border-gray-200 pb-1">
              <span className="font-bold col-span-2">End Date:</span><span className="col-span-2">{format(new Date(event.end_date || event.event_date), 'dd-MM-yyyy')}</span>
            </div>
            {/* Row 11 */}
            <div className="grid grid-cols-4 border-b border-gray-200 pb-1">
              <span className="font-bold col-span-2">No. of Student Participants:</span><span className="col-span-2">{formData.student_participants}</span>
            </div>
            {/* Row 12 */}
            <div className="grid grid-cols-4 border-b border-gray-200 pb-1">
              <span className="font-bold col-span-2">No. of Faculty Participants:</span><span className="col-span-2">{formData.faculty_participants}</span>
            </div>
            {/* Row 13 */}
            <div className="grid grid-cols-4 border-b border-gray-200 pb-1">
              <span className="font-bold col-span-2">No. of External Participants:</span><span className="col-span-2">{formData.external_participants}</span>
            </div>
            {/* Row 14 */}
            <div className="grid grid-cols-4 border-b border-gray-200 pb-1">
              <span className="font-bold col-span-2">Expenditure Amount:</span><span className="col-span-2">{event.budget_estimate > 0 ? `Rs. ${event.budget_estimate}` : 'N/A'}</span>
            </div>
            {/* Row 15 */}
            <div className="grid grid-cols-4 border-b border-gray-200 pb-1">
              <span className="font-bold col-span-2">Remarks:</span><span className="col-span-2">{formData.final_report_remarks || 'N/A'}</span>
            </div>
            {/* Row 16 (Last row, no border-b) */}
            <div className="grid grid-cols-4 pt-1">
              <span className="font-bold col-span-2">Mode of Session:</span><span className="col-span-2 capitalize">{event.mode_of_event}</span>
            </div>
          </div>
        </section>

        {/* Section 2: Overview (Added spacing) */}
        <section className="p-2 mt-4">
          <h4 className="font-bold text-center text-md mb-2 border-b border-gray-300 pb-1">Overview</h4>
          <div className="grid grid-cols-2 gap-x-4 text-sm space-y-2">
            <div><h5 className="font-bold mb-1">Objective:</h5><p>{aiObjective}</p></div>
            <div><h5 className="font-bold mb-1">Benefits in terms of learning/Skill/Knowledge Obtained:</h5><p>{event.proposed_outcomes}</p></div>
          </div>
        </section>

        {/* Section 3: Attachments (Image fit changed to object-contain) */}
        <section className="p-2 mt-4 page-break-before">
          <h4 className="font-bold text-center text-md mb-2 border-b border-gray-300 pb-1">Attachments</h4>
          <div className="grid grid-cols-2 gap-4">
            {photoUrls.map((url, index) => (
              <div key={index} className="border border-gray-300 p-1">
                <img src={url} alt={`Event Photo ${index + 1}`} className="w-full h-48 object-contain" />
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: Social Media */}
        <section className="p-2 mt-4">
          <h4 className="font-bold text-center text-md mb-2 border-b border-gray-300 pb-1">Promotion in Social Media</h4>
          <table className="w-full text-sm border-collapse border border-black">
            <thead><tr><th className="border border-black p-1">Social Media</th><th className="border border-black p-1">URL</th></tr></thead>
            <tbody>
              {Object.entries(reportData.formData).filter(([key]) => key.endsWith('_url') && key !== 'photos').map(([key, value]) => {
                if (!value) return null;
                const platform = key.replace('_url', '');
                return (<tr key={key}><td className="border border-black p-1 capitalize">{platform}</td><td className="border border-black p-1 break-all">{String(value)}</td></tr>);
              })}
            </tbody>
          </table>
        </section>
      </div>
    );
  };

  const handleClose = () => {
    setStep(1);
    setReportData(null);
    form.reset();
    onClose();
  };

  const selectedSocialMedia = form.watch('social_media_selection') || [];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={cn("sm:max-w-4xl max-h-[95vh] overflow-y-auto", step === 2 && "sm:max-w-6xl")}>
        <DialogHeader className="print:hidden">
          <DialogTitle>Generate Final Report: {event?.title}</DialogTitle>
          <DialogDescription>
            {step === 1 ? 'Step 1: Provide post-event details and upload photos.' : 'Step 2: Review and download the final report.'}
          </DialogDescription>
        </DialogHeader>
        
        {step === 1 && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleGenerateReport)} className="space-y-6">
              {/* Section 1 Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="student_participants" render={({ field }) => (<FormItem><FormLabel>No. of Student Participants</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="faculty_participants" render={({ field }) => (<FormItem><FormLabel>No. of Faculty Participants</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="external_participants" render={({ field }) => (<FormItem><FormLabel>No. of External Participants</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
                
                <FormField control={form.control} name="activity_lead_by" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Activity Lead By</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select lead role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ACTIVITY_LEAD_BY_OPTIONS.map(option => (
                          <SelectItem key={option} value={option}>{option}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                
                <FormItem>
                  <FormLabel>Duration (in hours)</FormLabel>
                  <Input value={durationHours} disabled />
                  <FormDescription className="text-xs">Calculated from event start/end time.</FormDescription>
                </FormItem>
                
                <FormField control={form.control} name="final_report_remarks" render={({ field }) => (<FormItem className="md:col-span-3"><FormLabel>Final Remarks</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
              </div>

              {/* Photo Uploads */}
              <div>
                <FormLabel>Event Photos (up to {MAX_PHOTOS}, JPEG/PNG, Max 2MB each)</FormLabel>
                <div {...getRootProps()} className={cn('p-8 mt-2 border-2 border-dashed rounded-md text-center cursor-pointer', isDragActive && 'border-primary bg-primary/10')}><input {...getInputProps()} /><UploadCloud className="mx-auto h-8 w-8 text-muted-foreground" /><p>Drag & drop photos here, or click to select</p></div>
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {form.watch('photos').map((file, index) => (<div key={index} className="relative"><img src={URL.createObjectURL(file)} alt="preview" className="w-full h-24 object-cover rounded" /><Button type="button" variant="destructive" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => removePhoto(index)}>X</Button></div>))}
                </div>
                <FormMessage>{form.formState.errors.photos?.message}</FormMessage>
              </div>

              {/* Social Media */}
              <div>
                <FormField control={form.control} name="social_media_selection" render={() => (
                  <FormItem>
                    <FormLabel>Social Media Promotion</FormLabel>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {socialMediaPlatforms.map((platform) => (<FormField key={platform.id} control={form.control} name="social_media_selection" render={({ field }) => (<FormItem className="flex items-center space-x-2"><FormControl><Checkbox checked={field.value?.includes(platform.id)} onCheckedChange={(checked) => {return checked ? field.onChange([...(field.value || []), platform.id]) : field.onChange(field.value?.filter((v) => v !== platform.id))}} /></FormControl><platform.icon className="h-5 w-5" /><FormLabel>{platform.label}</FormLabel></FormItem>)} />))}
                    </div>
                  </FormItem>
                )} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  {selectedSocialMedia.includes('twitter') && <FormField control={form.control} name="twitter_url" render={({ field }) => (<FormItem><FormLabel>Twitter URL</FormLabel><FormControl><Input {...field} placeholder="https://twitter.com/..." /></FormControl><FormMessage /></FormItem>)} />}
                  {selectedSocialMedia.includes('facebook') && <FormField control={form.control} name="facebook_url" render={({ field }) => (<FormItem><FormLabel>Facebook URL</FormLabel><FormControl><Input {...field} placeholder="https://facebook.com/..." /></FormControl><FormMessage /></FormItem>)} />}
                  {selectedSocialMedia.includes('instagram') && <FormField control={form.control} name="instagram_url" render={({ field }) => (<FormItem><FormLabel>Instagram URL</FormLabel><FormControl><Input {...field} placeholder="https://instagram.com/..." /></FormControl><FormMessage /></FormItem>)} />}
                  {selectedSocialMedia.includes('linkedin') && <FormField control={form.control} name="linkedin_url" render={({ field }) => (<FormItem><FormLabel>LinkedIn URL</FormLabel><FormControl><Input {...field} placeholder="https://linkedin.com/..." /></FormControl><FormMessage /></FormItem>)} />}
                </div>
              </div>
              <DialogFooter><Button type="submit" disabled={isGenerating}>{isGenerating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : 'Generate & Preview Report'}</Button></DialogFooter>
            </form>
          </Form>
        )}

        {step === 2 && (
          <>
            {renderReportContent()}
            <DialogFooter className="print:hidden">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>Back to Edit</Button>
              <Button onClick={handlePrint}><Download className="mr-2 h-4 w-4" /> Print / Save as PDF</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EventReportGeneratorDialog;