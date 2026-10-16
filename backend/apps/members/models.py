from django.db import models


class Members(models.Model):
    name = models.CharField(max_length=255)
    image = models.ImageField(upload_to="images/tms/coaches/")
    description = models.TextField()

    class Meta:
        verbose_name = "Member"
        verbose_name_plural = "Members"

    def __str__(self):
        return self.name
