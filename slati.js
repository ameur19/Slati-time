// Prayer Times Application
class PrayerTimesApp {
    constructor() {
        this.prayerTimes = null;
        this.location = { city: 'الرياض', country: 'المملكة العربية السعودية' };
        this.nextPrayer = null;
        this.loading = true;
        this.locationError = '';
        
        this.prayerNames = {
            Fajr: 'الفجر',
            Dhuhr: 'الظهر',
            Asr: 'العصر',
            Maghrib: 'المغرب',
            Isha: 'العشاء'
        };

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.startClock();
        this.getUserLocation();
    }

    setupEventListeners() {
        const locationBtn = document.getElementById('location-btn');
        locationBtn.addEventListener('click', () => this.getUserLocation());
    }

    startClock() {
        this.updateCurrentTime();
        setInterval(() => {
            this.updateCurrentTime();
            if (this.prayerTimes) {
                this.findNextPrayer();
            }
        }, 1000);
    }

    updateCurrentTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('ar-SA');
        const dateString = now.toLocaleDateString('ar-SA', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        document.getElementById('current-time').textContent = timeString;
        document.getElementById('current-date').textContent = dateString;
    }

    async getUserLocation() {
        this.showLoading('جاري تحديد موقعك...');
        this.hideLocationError();

        if (!navigator.geolocation) {
            this.showLocationError('المتصفح لا يدعم تحديد الموقع');
            await this.fetchPrayerTimesByCity();
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                try {
                    // Get city name from coordinates
                    const locationResponse = await fetch(
                        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=ar`
                    );
                    const locationData = await locationResponse.json();
                    
                    this.location = {
                        city: locationData.city || locationData.locality || 'موقعك الحالي',
                        country: locationData.countryName || 'غير محدد',
                        latitude,
                        longitude
                    };
                    
                    this.updateLocationDisplay();
                    await this.fetchPrayerTimesByCoordinates(latitude, longitude);
                } catch (error) {
                    console.error('خطأ في تحديد الموقع:', error);
                    this.showLocationError('فشل في تحديد الموقع');
                    await this.fetchPrayerTimesByCity();
                }
            },
            async (error) => {
                console.error('خطأ في الحصول على الموقع:', error);
                this.showLocationError('تم رفض الوصول للموقع');
                await this.fetchPrayerTimesByCity();
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000 // 5 minutes
            }
        );
    }

    async fetchPrayerTimesByCoordinates(latitude, longitude) {
        try {
            this.showLoading('جاري تحميل أوقات الصلاة...');
            const response = await fetch(
                `https://api.aladhan.com/v1/timings?latitude=${latitude}&longitude=${longitude}&method=4`
            );
            const data = await response.json();
            
            if (data.code === 200) {
                this.prayerTimes = {
                    Fajr: data.data.timings.Fajr,
                    Dhuhr: data.data.timings.Dhuhr,
                    Asr: data.data.timings.Asr,
                    Maghrib: data.data.timings.Maghrib,
                    Isha: data.data.timings.Isha
                };
                this.updatePrayerTimesDisplay();
                this.findNextPrayer();
                this.hideLoading();
            }
        } catch (error) {
            console.error('خطأ في جلب أوقات الصلاة:', error);
            await this.fetchPrayerTimesByCity();
        }
    }

    async fetchPrayerTimesByCity() {
        try {
            this.showLoading('جاري تحميل أوقات الصلاة...');
            // Using Riyadh as default location
            const response = await fetch('https://api.aladhan.com/v1/timingsByCity?city=Riyadh&country=Saudi Arabia&method=4');
            const data = await response.json();
            
            if (data.code === 200) {
                this.prayerTimes = {
                    Fajr: data.data.timings.Fajr,
                    Dhuhr: data.data.timings.Dhuhr,
                    Asr: data.data.timings.Asr,
                    Maghrib: data.data.timings.Maghrib,
                    Isha: data.data.timings.Isha
                };
            } else {
                // Fallback times
                this.prayerTimes = {
                    Fajr: '04:45',
                    Dhuhr: '12:10',
                    Asr: '15:30',
                    Maghrib: '18:45',
                    Isha: '20:15'
                };
            }
            
            this.updatePrayerTimesDisplay();
            this.findNextPrayer();
            this.hideLoading();
        } catch (error) {
            console.error('خطأ في جلب أوقات الصلاة:', error);
            // Fallback times in case of API failure
            this.prayerTimes = {
                Fajr: '04:45',
                Dhuhr: '12:10',
                Asr: '15:30',
                Maghrib: '18:45',
                Isha: '20:15'
            };
            this.updatePrayerTimesDisplay();
            this.findNextPrayer();
            this.hideLoading();
        }
    }

    updateLocationDisplay() {
        document.getElementById('location-text').textContent = `${this.location.city}, ${this.location.country}`;
    }

    updatePrayerTimesDisplay() {
        const prayerCards = document.querySelectorAll('.prayer-card');
        
        prayerCards.forEach(card => {
            const prayerName = card.dataset.prayer;
            const timeElement = card.querySelector('.prayer-time');
            const time24 = this.prayerTimes[prayerName];
            const time12 = this.formatTime12Hour(time24);
            timeElement.textContent = time12;
        });
    }

    findNextPrayer() {
        if (!this.prayerTimes) return;

        const now = new Date();
        const today = now.toDateString();
        const prayers = Object.entries(this.prayerTimes);
        
        // Remove previous next-prayer class
        document.querySelectorAll('.prayer-card').forEach(card => {
            card.classList.remove('next-prayer');
        });

        for (const [prayerName, time] of prayers) {
            const prayerTime = new Date(`${today} ${time}`);
            if (prayerTime > now) {
                this.nextPrayer = {
                    name: prayerName,
                    time: time,
                    arabicName: this.prayerNames[prayerName]
                };
                
                this.updateNextPrayerDisplay();
                this.updateCountdown(prayerTime, now);
                
                // Add next-prayer class to the corresponding card
                const nextPrayerCard = document.querySelector(`[data-prayer="${prayerName}"]`);
                if (nextPrayerCard) {
                    nextPrayerCard.classList.add('next-prayer');
                }
                
                return;
            }
        }
        
        // If no prayer left today, next is Fajr tomorrow
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const fajrTomorrow = new Date(`${tomorrow.toDateString()} ${this.prayerTimes.Fajr}`);
        
        this.nextPrayer = {
            name: 'Fajr',
            time: this.prayerTimes.Fajr,
            arabicName: 'الفجر'
        };
        
        this.updateNextPrayerDisplay();
        this.updateCountdown(fajrTomorrow, now);
        
        // Add next-prayer class to Fajr card
        const fajrCard = document.querySelector('[data-prayer="Fajr"]');
        if (fajrCard) {
            fajrCard.classList.add('next-prayer');
        }
    }

    updateNextPrayerDisplay() {
        if (!this.nextPrayer) return;

        document.getElementById('next-prayer-name').textContent = this.nextPrayer.arabicName;
        document.getElementById('next-prayer-time').textContent = this.formatTime12Hour(this.nextPrayer.time);
        document.getElementById('next-prayer').classList.remove('hidden');
    }

    updateCountdown(prayerTime, now) {
        const timeDiff = prayerTime.getTime() - now.getTime();
        const hours = Math.floor(timeDiff / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
        
        const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('countdown-timer').textContent = timeString;
    }

    formatTime12Hour(time24) {
        const [hours, minutes] = time24.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'م' : 'ص';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
    }

    showLoading(text = 'جاري التحميل...') {
        document.getElementById('loading-text').textContent = text;
        document.getElementById('loading').classList.remove('hidden');
        document.getElementById('main-content').classList.add('hidden');
    }

    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('main-content').classList.remove('hidden');
    }

    showLocationError(message) {
        this.locationError = message;
        document.getElementById('error-text').textContent = `${message} - يتم عرض أوقات الرياض كافتراضي`;
        document.getElementById('location-error').classList.remove('hidden');
        document.getElementById('location-btn').classList.remove('hidden');
    }

    hideLocationError() {
        document.getElementById('location-error').classList.add('hidden');
        document.getElementById('location-btn').classList.add('hidden');
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new PrayerTimesApp();
});