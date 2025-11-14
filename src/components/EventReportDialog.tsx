import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Download, UploadCloud, Image, MessageSquare, Link as LinkIcon, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { generateReportOverview } from '@/utils/report';

// --- Zod Schema for Report Submission ---
const reportSchema = z.object({
  final_report_remarks: z.string().optional(),
  social_media_links: z.array(z.object({
    url: z.string().url('Must be a valid URL').min(1, 'URL is required'),
  })).optional(),
});

type ReportFormSchema = z.infer<typeof reportSchema>;

type EventReportDialogProps = {
  event: any;
  isOpen: boolean;
  onClose: () => void;
};

type ReportData = any;

const formatTime12Hour = (time24: string | null | undefined): string => {
  if (!time24) return 'N/A';
  try {
    const [h, m] = time24.split(':');
    const hour = parseInt(h, 10);
    const minute = parseInt(m, 10);

    const period = hour >= 12 ? 'PM' : 'AM';
    let hour12 = hour % 12;
    if (hour12 > 12) {
      hour12 -= 12;
    }
    if (hour12 === 0) {
      hour12 = 12;
    }

    return `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;
  } catch (error) {
    return time24;
  }
};

// Helper component for displaying data in the new two-column report format
const ReportField = ({ label, value }: { label: string; value: any }) => {
  const processValue = (val: any): React.ReactNode => {
    if (val === null || val === undefined || val === 0 || val === '') return 'N/A';
    if (Array.isArray(val)) {
      if (val.length === 0) return 'N/A';
      
      // Handle array of strings (e.g., categories, funding)
      if (typeof val[0] === 'string') {
        return val.map(item => String(item).charAt(0).toUpperCase() + String(item).slice(1).replace(/_/g, ' ')).join(', ');
      }
      
      // Handle array of objects (e.g., social media links)
      if (typeof val[0] === 'object' && val[0].url) {
        return (
          <ul className="list-disc list-inside">
            {val.map((item: { url: string }, index: number) => {
              try {
                const url = new URL(item.url);
                // Extract domain and capitalize the first part (e.g., facebook.com -> Facebook)
                const domain = url.hostname.replace('www.', '').split('.')[0];
                const platformName = domain.charAt(0).toUpperCase() + domain.slice(1);
                
                return (
                  <li key={index}>
                    <strong className="font-medium">{platformName}:</strong> <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">{item.url}</a>
                  </li>
                );
              } catch {
                return <li key={index} className="text-red-500">Invalid URL: {item.url}</li>;
              }
            })}
          </ul>
        );
      }
      
      return JSON.stringify(val);
    }
    if (typeof val === 'string') return val.trim() === '' ? 'N/A' : val;
    if (typeof val === 'object' && val !== null) return val;
    return String(val);
  };

  return (
    <div className="py-1">
      <strong className="text-gray-600">{label}:</strong>
      <span className="text-gray-800 ml-1">{processValue(value)}</span>
    </div>
  );
};


const EventReportContent = ({ data, forwardedRef }: { data: ReportData, forwardedRef: React.Ref<HTMLDivElement> }) => {
  if (!data) return null;

  const formatApproval = (timestamp: string | null) => {
    if (!timestamp) return 'Pending';
    return `Approved on ${format(new Date(timestamp), 'PPP p')}`;
  };
  
  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;
  const academicYear = `${currentYear}-${nextYear}`;
  
  let departmentClub = data.department_club || 'N/A';
  const departmentRegex = /(.*) \((.*)\)/;
  const match = departmentClub.match(departmentRegex);

  if (match && match[1] && match[2]) {
    const departmentName = match[1].trim();
    const degree = match[2].trim();
    departmentClub = `(${degree})-${departmentName}`;
  }

  const uniqueId = data.unique_code || 'N/A';
  const referenceNumber = `ACE/IQAC/Events/${academicYear}/${departmentClub}/${uniqueId}`;

  const venueDetails = data.venues?.name ? `${data.venues.name} (${data.venues.location || 'N/A'})` : data.other_venue_details || 'N/A';
  
  const generatedOverview = generateReportOverview(data);

  return (
    <div className="printable-report" ref={forwardedRef}>
      <div className="p-4 bg-white text-black relative">
        <div className="absolute top-4 right-4 text-sm font-mono bg-gray-100 p-2 rounded border">
          ID: {data.unique_code || 'N/A'}
        </div>
        {/* College Header (KEEPING AS REQUESTED) */}
        <div className="text-center mb-2">
          <h1 className="text-lg font-bold text-gray-800">Adhiyamaan College of Engineering</h1>
          <p className="text-sm text-gray-600">(An Autonomous Institution)</p>
          <p className="text-sm text-gray-600">Dr. M. G. R. Nagar, Hosur</p>
          <h2 className="text-base font-semibold text-gray-700 mt-2">Internal Quality Assurance Cell (IQAC)</h2>
        </div>
        
        {/* Reference Number Line (KEEPING AS REQUESTED) */}
        <div className="text-left mb-4">
          <p className="text-sm font-medium text-gray-700">{referenceNumber}</p>
        </div>
        
        {/* Form Title (KEEPING AS REQUESTED) */}
        <h3 className="text-center text-base font-bold underline mb-4">Event Registration and Approval Form</h3>

        {/* --- Main Content (Two-Column Layout based on images) --- */}
        <div className="border border-gray-400 p-4 space-y-4">
          
          {/* Section 1: Program Details */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm border-b pb-4">
            <ReportField label="Academic Year" value={data.academic_year} />
            <ReportField label="Program driven by" value={data.program_driven_by} />

            <ReportField label="Quarter" value={data.quarter} />
            <ReportField label="Program/Activity Name" value={data.title} />

            <ReportField label="Program Type" value={data.program_type} />
            <ReportField label="Activity Lead By" value={data.activity_lead_by} />

            <ReportField label="Program Theme" value={data.program_theme} />
            <ReportField label="Duration of the activity (In Hrs)" value={data.activity_duration_hours} />
          </div>
          
          {/* Section 2: Schedule & Venue */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm border-b pb-4">
            <ReportField label="Start Date" value={data.event_date ? format(new Date(data.event_date), 'PPP') : 'N/A'} />
            <ReportField label="End Date" value={data.end_date ? format(new Date(data.end_date), 'PPP') : 'N/A'} />
            
            <ReportField label="Start Time" value={formatTime12Hour(data.start_time)} />
            <ReportField label="End Time" value={formatTime12Hour(data.end_time)} />
            
            <div className="col-span-2 py-1">
              <strong className="text-gray-600">Venue:</strong>
              <span className="text-gray-800 ml-1">{venueDetails}</span>
            </div>
          </div>

          {/* Section 3: Participants & Expenditure */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm border-b pb-4">
            <ReportField label="Number of Student Participants" value={data.student_participants} />
            <ReportField label="Number of Faculty Participants" value={data.faculty_participants} />

            <ReportField label="Number of External Participants, if any" value={data.external_participants} />
            <ReportField label="Expenditure Amount, If any" value={`₹${data.budget_estimate?.toFixed(2) || '0.00'}`} />
            
            <ReportField label="Mode of Session delivery" value={data.mode_of_event ? String(data.mode_of_event).charAt(0).toUpperCase() + String(data.mode_of_event).slice(1) : 'N/A'} />
            <ReportField label="Department/Club" value={data.department_club} />
          </div>
          
          {/* Section 4: Overview (Generated Summary ONLY) */}
          <div className="border border-gray-400">
            <div className="p-2 bg-gray-100 border-b border-gray-400 font-bold text-sm">OVERVIEW</div>
            <div className="p-2 text-sm">
                <div className="py-1">
                    <strong className="text-base">Generated Summary:</strong>
                    <p className="text-base text-gray-700 mt-1">{generatedOverview}</p>
                </div>
            </div>
          </div>
          
          {/* Section 5: Attachments and Promotion */}
          <div className="border border-gray-400">
            <div className="p-2 bg-gray-100 border-b border-gray-400 font-bold text-sm">ATTACHMENTS & PROMOTION IN SOCIAL MEDIA</div>
            <div className="p-2 space-y-2">
              <ReportField label="Video/Social Media Links" value={data.social_media_links} />
              
              <div className="grid grid-cols-3 gap-4 py-2 border-t border-gray-200">
                <div className="font-semibold text-sm text-gray-600">Evidence Photos (Max 3)</div>
                <div className="col-span-2 text-sm text-gray-800">
                  {(data.report_photo_urls && data.report_photo_urls.length > 0) ? (
                    <div className="grid grid-cols-3 gap-2">
                      {data.report_photo_urls.map((url: string, index: number) => (
                        <a key={index} href={url} target="_blank" rel="noopener noreferrer" className="block border rounded-md overflow-hidden hover:opacity-80 transition-opacity">
                          <img src={url} alt={`Evidence ${index + 1}`} className="w-full h-auto object-cover" />
                        </a>
                      ))}
                    </div>
                  ) : 'N/A'}
                </div>
              </div>
            </div>
          </div>
          
          {/* Section 6: Approvals */}
          <div className="border border-gray-400">
            <div className="grid grid-cols-3 gap-4 p-2 bg-gray-100 border-b border-gray-400 font-bold text-sm">
              <div className="col-span-3">APPROVAL STATUS</div>
            </div>
            <div className="p-2 grid grid-cols-3 gap-4 text-xs">
                <div><strong>HOD:</strong> {formatApproval(data.hod_approval_at)}</div>
                <div><strong>Dean IR:</strong> {formatApproval(data.dean_approval_at)}</div>
                <div><strong>Principal:</strong> {formatApproval(data.principal_approval_at)}</div>
            </div>
        </div>
        
        </div>
      </div>
    </div>
  );
};

const EventReportDialog = ({ event, isOpen, onClose }: EventReportDialogProps) => {
  const { user } = useAuth();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportFiles, setReportFiles] = useState<File[]>([]);
  const reportContentRef = useRef<HTMLDivElement>(null);
  
  const isApproved = event?.status === 'approved';
  const isCoordinator = user?.id === event?.submitted_by;
  const isReportEditable = isApproved && isCoordinator;

  const form = useForm<ReportFormSchema>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      final_report_remarks: '',
      social_media_links: [{ url: '' }],
    },
  });
  
  const { fields: linkFields, append: appendLink, remove: removeLink } = useFieldArray({
    control: form.control,
    name: "social_media_links",
  });

  const fetchReportData = async () => {
    if (!event) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          venues ( name, location )
        `)
        .eq('id', event.id)
        .single();

      if (error) throw error;
      setReportData(data);
      
      // Reset form with fetched data
      const links = (data.social_media_links as { url: string }[] || []).filter(link => link.url);
      
      form.reset({
        final_report_remarks: data.final_report_remarks || '',
        social_media_links: links.length > 0 ? links : [{ url: '' }],
      });
      
      // Clear files on fetch
      setReportFiles([]);

    } catch (error: any) {
      toast.error(`Failed to load report data: ${error.message}`);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchReportData();
    } else {
      setReportData(null);
      form.reset();
    }
  }, [isOpen, event]);

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
    if (fileRejections.length > 0) {
      toast.error('File upload rejected. Max 3 images (JPEG/PNG) up to 1MB each.');
      return;
    }
    if (reportFiles.length + acceptedFiles.length > 3) {
      toast.error('You can upload a maximum of 3 evidence images.');
      return;
    }
    setReportFiles(prev => [...prev, ...acceptedFiles]);
  }, [reportFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpeg', '.jpg'],
      'image/png': ['.png'],
    },
    maxFiles: 3,
    maxSize: 1024 * 1024, // 1MB
    disabled: !isReportEditable || reportFiles.length >= 3,
  });
  
  const removeFile = (index: number) => {
    setReportFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadReportImages = async (files: File[]) => {
    const uploadedUrls: string[] = [];
    for (const file of files) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${event.id}/reports/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('event_posters') // Using existing bucket
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Image upload failed for ${file.name}: ${uploadError.message}`);
      }

      const { data: { publicUrl } } = supabase.storage
        .from('event_posters')
        .getPublicUrl(fileName);
        
      uploadedUrls.push(publicUrl);
    }
    return uploadedUrls;
  };

  const onSubmitReport = async (values: ReportFormSchema) => {
    if (!event || !user) return;
    setIsSubmitting(true);
    
    try {
      // 1. Upload new images
      const newImageUrls = await uploadReportImages(reportFiles);
      
      // 2. Combine existing and new images
      const existingUrls = reportData?.report_photo_urls || [];
      const finalPhotoUrls = [...existingUrls, ...newImageUrls];
      
      // 3. Prepare social media links (filter out empty ones)
      const finalSocialMediaLinks = values.social_media_links?.filter(link => link.url.trim()) || [];

      // 4. Update the event record
      const { error } = await supabase
        .from('events')
        .update({
          final_report_remarks: values.final_report_remarks || null,
          report_photo_urls: finalPhotoUrls,
          social_media_links: finalSocialMediaLinks,
        })
        .eq('id', event.id);

      if (error) throw error;

      toast.success('Post-event report submitted successfully.');
      // Re-fetch data to update the view
      await fetchReportData();
      setReportFiles([]);
    } catch (e: any) {
      toast.error(`Submission failed: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    if (!reportContentRef.current) return;

    const printContents = reportContentRef.current.innerHTML;
    
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

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader className="print:hidden">
            <DialogTitle>Event Report: {event?.title}</DialogTitle>
            <DialogDescription>
              Official report containing all event details and approval statuses.
            </DialogDescription>
          </DialogHeader>
          
          {loading && !reportData ? (
            <div className="text-center py-10">Loading report...</div>
          ) : reportData ? (
            <>
              <EventReportContent data={reportData} forwardedRef={reportContentRef} />
              
              {/* --- Post-Event Submission Form (Coordinator Only) --- */}
              {isReportEditable && (
                <div className="border-t pt-6 mt-6 print:hidden">
                  <h3 className="text-xl font-bold mb-4">Post-Event Evidence Submission</h3>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmitReport)} className="space-y-6">
                      
                      <FormField
                        control={form.control}
                        name="final_report_remarks"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Final Report Remarks (Used for Generated Overview)</FormLabel>
                            <FormControl>
                              <Textarea 
                                placeholder="Provide a brief summary of the event execution and final outcomes." 
                                rows={4}
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      {/* Image Upload Section */}
                      <div className="space-y-2">
                        <FormLabel>Evidence Photos (Max 3 Images, JPEG/PNG, 1MB each)</FormLabel>
                        <div
                          {...getRootProps()}
                          className={`p-6 border-2 border-dashed rounded-md text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/10' : 'border-border'} ${reportFiles.length >= 3 ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <input {...getInputProps()} />
                          <UploadCloud className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                          <p className="text-sm">Drag 'n' drop images here, or click to select files</p>
                        </div>
                        
                        <div className="flex flex-wrap gap-2 pt-2">
                          {reportFiles.map((file, index) => (
                            <div key={index} className="relative p-2 border rounded-md flex items-center space-x-2 bg-muted">
                              <Image className="h-4 w-4 flex-shrink-0" />
                              <span className="text-xs truncate max-w-[150px]">{file.name}</span>
                              <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeFile(index)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                          {(reportData?.report_photo_urls || []).length > 0 && (
                            <Alert className="text-xs py-2 px-3">
                              <AlertTitle className="text-xs font-medium">Existing Photos: {(reportData.report_photo_urls || []).length}</AlertTitle>
                            </Alert>
                          )}
                        </div>
                      </div>
                      
                      {/* Social Media Links Section */}
                      <div className="space-y-2">
                        <FormLabel>Social Media Links (where event photos are posted)</FormLabel>
                        {linkFields.map((item, index) => (
                          <div key={item.id} className="flex items-center gap-2">
                            <FormField
                              control={form.control}
                              name={`social_media_links.${index}.url`}
                              render={({ field }) => (
                                <FormItem className="flex-grow">
                                  <FormControl>
                                    <Input placeholder="https://facebook.com/event-link" {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            {linkFields.length > 1 && (
                              <Button type="button" variant="destructive" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => removeLink(index)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button type="button" variant="outline" size="sm" onClick={() => appendLink({ url: '' })}>
                          <Plus className="h-4 w-4 mr-2" /> Add Link
                        </Button>
                      </div>

                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                        <Button type="submit" disabled={isSubmitting}>
                          {isSubmitting ? 'Submitting Evidence...' : 'Submit Evidence'}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </div>
              )}
              {/* --- End Post-Event Submission Form --- */}
            </>
          ) : (
            <div className="text-center py-10 text-red-500">
              Error loading report data.
            </div>
          )}
          
          <DialogFooter className="print:hidden">
            <Button 
              onClick={handlePrint} 
              disabled={loading || !reportData}
              className="bg-primary hover:bg-primary/90"
            >
              <Download className="mr-2 h-4 w-4" /> Print / Save as PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EventReportDialog;