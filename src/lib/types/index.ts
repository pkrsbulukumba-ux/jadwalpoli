// Definisi Tipe Data Domain Kiosk & CMS sesuai PRD.md

export interface Polyclinic {
	id: string;
	name: string;
	code: string;
	icon?: string;
	description?: string;
	is_active: boolean;
	display_order: number;
	created_at?: string;
	updated_at?: string;
}

export interface Doctor {
	id: string;
	full_name: string;
	title?: string;
	photo_url?: string;
	polyclinic_id?: string; // ID Poliklinik utama penugasan dokter
	is_active: boolean;
	display_order: number;
	created_at?: string;
	updated_at?: string;
}

export interface DoctorPolyclinic {
	id: string;
	doctor_id: string;
	polyclinic_id: string;
	is_primary: boolean;
}

export interface WeeklySchedule {
	id: string;
	doctor_id: string;
	polyclinic_id: string;
	day_of_week: number; // 1 = Senin, 2 = Selasa, ... 7 = Minggu
	start_time: string; // HH:mm:ss atau HH:mm
	end_time: string;
	is_active: boolean;
	note?: string;
	created_at?: string;
	updated_at?: string;
}

export interface ScheduleOverride {
	id: string;
	doctor_id: string;
	polyclinic_id: string;
	schedule_date: string; // YYYY-MM-DD
	status_code: string;
	custom_message?: string;
	created_at?: string;
	updated_at?: string;
}

export interface PracticeStatus {
	id?: string;
	code: string;
	label: string;
	icon: string;
	color: string;
	is_active: boolean;
	display_order: number;
}

export interface MediaAnnouncement {
	id: string;
	title: string;
	media_type: 'image' | 'video';
	file_path: string;
	public_url: string;
	storage_type?: 'online' | 'local_path' | 'upload';
	sort_order: number;
	is_active: boolean;
	created_at?: string;
	updated_at?: string;
}

export interface KioskSettings {
	hospital_name: string;
	hospital_subtitle: string;
	hospital_logo_url: string;
	timezone: string;
	date_format: string;
	time_format: string;
	slide_duration_seconds: number;
	image_duration_seconds: number;
	video_wait_for_end: boolean;
	video_sound_enabled?: boolean;
	refresh_interval_seconds: number;
	font_scale: number;
	card_scale: number;
	header_scale: number;
	footer_scale: number;
	show_page_indicator: boolean;
	show_running_text: boolean;
	show_footer_notices: boolean;
	show_emergency_banner: boolean;
	emergency_title?: string;
	emergency_message?: string;
	emergency_level?: 'info' | 'warning' | 'critical';
	running_text: string;
	running_text_speed: number;
	running_text_direction: 'left' | 'right';
	master_pin_hash?: string;
	screen_mode?: '43' | '55' | '65';
}

export interface FooterNotice {
	id: string;
	title: string;
	icon: string;
	is_active: boolean;
	display_order: number;
}

// Presentation / View-Model Types untuk Live Kiosk Display
export type StatusType = 'open' | 'closed' | 'break' | 'cancelled' | 'upcoming' | 'holiday';

export interface DoctorStatusPresentation {
	code: string;
	label: string;
	subtext?: string;
	type: StatusType;
}

export interface DoctorScheduleCardData {
	doctor: Doctor;
	schedules: WeeklySchedule[];
	todaySchedule?: WeeklySchedule;
	status: DoctorStatusPresentation;
}

export interface PoliSectionData {
	polyclinic: Polyclinic;
	doctorCount: number;
	doctors: DoctorScheduleCardData[];
}

export type KioskSlide =
	| {
			id: string;
			type: 'schedule';
			pageNumber: number;
			totalPages: number;
			sections: PoliSectionData[];
			durationSeconds: number;
	  }
	| {
			id: string;
			type: 'media';
			pageNumber: number;
			totalPages: number;
			media: MediaAnnouncement;
			durationSeconds: number;
	  };

export interface AuditLog {
	id: string;
	timestamp: string;
	action: string;
	entity_type: 'polyclinic' | 'doctor' | 'schedule' | 'override' | 'media' | 'settings' | 'auth';
	entity_id?: string;
	actor_name: string;
	details: string;
}
